import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { ReadyToStaffService } from '../clinicians/ready-to-staff.service.js';
import { SubmitItemDto } from './dto/submit-item.dto.js';
import { ReviewItemDto } from './dto/review-item.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { ChecklistItemStatus } from '../../../generated/prisma/client.js';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class ChecklistItemsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private storage: StorageService,
    @Inject(forwardRef(() => ReadyToStaffService))
    private readyToStaff: ReadyToStaffService,
  ) {}

  /**
   * Get all checklist items for a clinician, grouped by section.
   */
  async findByClinician(clinicianId: string, organizationId: string) {
    const items = await this.prisma.clinicianChecklistItem.findMany({
      where: { clinicianId, organizationId },
      include: {
        itemDefinition: {
          select: {
            id: true,
            templateId: true,
            label: true,
            section: true,
            type: true,
            required: true,
            blocking: true,
            adminOnly: true,
            hasExpiration: true,
            sortOrder: true,
            configJson: true,
            instructions: true,
            highRisk: true,
            linkedDocumentId: true,
          },
        },
      },
      orderBy: { itemDefinition: { sortOrder: 'asc' } },
    });

    // Group by section
    const sections: Record<string, typeof items> = {};
    for (const item of items) {
      const section = item.itemDefinition.section;
      if (!sections[section]) sections[section] = [];
      sections[section].push(item);
    }

    return { items, sections };
  }

  /**
   * Submit a checklist item (clinician action).
   */
  async submit(
    itemId: string,
    dto: SubmitItemDto,
    user: AuthenticatedUser,
    clientIp?: string,
  ) {
    const item = await this.prisma.clinicianChecklistItem.findFirst({
      where: { id: itemId, organizationId: user.organizationId },
      include: { itemDefinition: true },
    });

    if (!item) throw new NotFoundException('Checklist item not found');

    // Validate item is submittable
    if (item.itemDefinition.adminOnly && user.role === 'clinician') {
      throw new ForbiddenException('This item can only be set by admin');
    }

    if (item.status === 'approved') {
      throw new BadRequestException('Item already approved — contact admin to re-open');
    }

    // Build update data based on item type
    const updateData: any = {
      status: 'submitted' as ChecklistItemStatus,
    };

    switch (item.itemDefinition.type) {
      case 'file_upload':
        if (!dto.docStoragePath) throw new BadRequestException('File upload required');
        updateData.docStoragePath = dto.docStoragePath;
        updateData.docOriginalName = dto.docOriginalName || null;
        updateData.docMimeType = dto.docMimeType || null;
        if (dto.expiresAt) updateData.expiresAt = new Date(dto.expiresAt);
        break;

      case 'text':
        if (!dto.valueText) throw new BadRequestException('Text value required');
        updateData.valueText = dto.valueText;
        break;

      case 'date':
        if (!dto.valueDate) throw new BadRequestException('Date value required');
        updateData.valueDate = new Date(dto.valueDate);
        break;

      case 'select':
        if (!dto.valueSelect) throw new BadRequestException('Selection required');
        updateData.valueSelect = dto.valueSelect;
        break;

      case 'e_signature': {
        // Enhanced e-signature: typed name + agreement + timestamp + IP + hash
        if (!dto.signerName) throw new BadRequestException('Signer name is required for e-signature');
        if (!dto.agreement) throw new BadRequestException('Agreement must be accepted for e-signature');

        const signatureTimestamp = new Date();
        const signerIp = clientIp || 'unknown';
        const signatureHash = createHash('sha256')
          .update(`${dto.signerName}|${item.clinicianId}|${itemId}|${signatureTimestamp.toISOString()}`)
          .digest('hex');

        updateData.valueText = 'signed';
        updateData.signerName = dto.signerName;
        updateData.signatureTimestamp = signatureTimestamp;
        updateData.signerIp = signerIp;
        updateData.signatureHash = signatureHash;
        updateData.status = 'approved' as ChecklistItemStatus; // auto-approve
        updateData.reviewedAt = signatureTimestamp;

        // If item definition has a linked document, store a signature receipt
        if (item.itemDefinition.linkedDocumentId) {
          const receiptKey = `${user.organizationId}/${item.clinicianId}/${itemId}/signature-receipt-${randomUUID()}.json`;
          const receipt = {
            signerName: dto.signerName,
            signatureTimestamp: signatureTimestamp.toISOString(),
            signerIp,
            signatureHash,
            itemId,
            clinicianId: item.clinicianId,
            linkedDocumentId: item.itemDefinition.linkedDocumentId,
            itemLabel: item.itemDefinition.label,
          };

          // Upload receipt to S3
          const { url } = await this.storage.getUploadUrlForKey(receiptKey, 'application/json');
          try {
            await fetch(url, {
              method: 'PUT',
              body: JSON.stringify(receipt),
              headers: { 'Content-Type': 'application/json' },
            });
            updateData.signedDocPath = receiptKey;
          } catch {
            // Non-blocking: receipt upload failure doesn't prevent signature
            updateData.signedDocPath = null;
          }
        }
        break;
      }

      case 'admin_status':
        if (user.role === 'clinician') {
          throw new ForbiddenException('Admin status items are admin-only');
        }
        if (!dto.valueSelect) throw new BadRequestException('Status selection required');
        updateData.valueSelect = dto.valueSelect;
        updateData.status = 'approved' as ChecklistItemStatus;
        updateData.reviewedById = user.id;
        updateData.reviewedAt = new Date();
        break;
    }

    const updated = await this.prisma.clinicianChecklistItem.update({
      where: { id: itemId },
      data: updateData,
      include: { itemDefinition: true },
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      clinicianId: item.clinicianId,
      entityType: 'checklist_item',
      entityId: itemId,
      action: 'item_submitted',
      details: { type: item.itemDefinition.type, label: item.itemDefinition.label },
    });

    // Recompute status if item was auto-approved (e_signature, admin_status)
    if (updated.status === 'approved') {
      await this.readyToStaff.computeStatus(item.clinicianId, user.organizationId);
    }

    return updated;
  }

  /**
   * Review a checklist item (admin action — approve or reject).
   */
  async review(
    itemId: string,
    dto: ReviewItemDto,
    user: AuthenticatedUser,
  ) {
    const item = await this.prisma.clinicianChecklistItem.findFirst({
      where: { id: itemId, organizationId: user.organizationId },
      include: { itemDefinition: true },
    });

    if (!item) throw new NotFoundException('Checklist item not found');

    if (item.status !== 'submitted' && item.status !== 'pending_review') {
      throw new BadRequestException(
        `Cannot review item with status "${item.status}". Item must be submitted first.`,
      );
    }

    const updateData: any = {
      status: dto.status as ChecklistItemStatus,
      reviewedById: user.id,
      reviewedAt: new Date(),
    };

    if (dto.status === 'rejected') {
      updateData.rejectionReason = dto.rejectionReason || null;
      updateData.rejectionComment = dto.rejectionComment || null;
    } else {
      // Clear rejection fields on approval
      updateData.rejectionReason = null;
      updateData.rejectionComment = null;
    }

    const updated = await this.prisma.clinicianChecklistItem.update({
      where: { id: itemId },
      data: updateData,
      include: { itemDefinition: true },
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      clinicianId: item.clinicianId,
      entityType: 'checklist_item',
      entityId: itemId,
      action: dto.status === 'approved' ? 'item_approved' : 'item_rejected',
      details: {
        label: item.itemDefinition.label,
        ...(dto.rejectionReason && { reason: dto.rejectionReason }),
        ...(dto.rejectionComment && { comment: dto.rejectionComment }),
      },
    });

    // Recompute clinician ready-to-staff status after every review
    await this.readyToStaff.computeStatus(item.clinicianId, user.organizationId);

    return updated;
  }
}
