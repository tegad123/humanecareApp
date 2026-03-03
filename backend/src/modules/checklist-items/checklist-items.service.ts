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

  private isPrivilegedRole(role: string) {
    return ['super_admin', 'admin', 'recruiter', 'compliance'].includes(role);
  }

  private hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private hashText(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async resolveLinkedDocumentEvidence(
    organizationId: string,
    linkedDocumentId: string | null,
    fallbackAgreementText: string,
  ): Promise<{
    linkedDocumentId: string | null;
    linkedDocumentPath: string | null;
    linkedDocumentHash: string;
    linkedDocumentVersion: number | null;
  }> {
    if (!linkedDocumentId) {
      return {
        linkedDocumentId: null,
        linkedDocumentPath: null,
        linkedDocumentHash: this.hashText(fallbackAgreementText),
        linkedDocumentVersion: null,
      };
    }

    const linkedDocument = await this.prisma.templateDocument.findFirst({
      where: { id: linkedDocumentId, organizationId },
      select: { id: true, storagePath: true, templateId: true },
    });

    if (!linkedDocument) {
      return {
        linkedDocumentId,
        linkedDocumentPath: null,
        linkedDocumentHash: this.hashText(fallbackAgreementText),
        linkedDocumentVersion: null,
      };
    }

    let linkedDocumentHash = this.hashText(`missing:${linkedDocument.storagePath}`);
    try {
      const file = await this.storage.getFile(linkedDocument.storagePath);
      linkedDocumentHash = this.hashBuffer(file.buffer);
    } catch {
      // Keep deterministic fallback hash when linked bytes are unavailable.
    }

    let linkedDocumentVersion: number | null = null;
    if (linkedDocument.templateId) {
      const template = await this.prisma.checklistTemplate.findFirst({
        where: { id: linkedDocument.templateId, organizationId },
        select: { publishedRevision: true },
      });
      linkedDocumentVersion = template?.publishedRevision ?? null;
    }

    return {
      linkedDocumentId: linkedDocument.id,
      linkedDocumentPath: linkedDocument.storagePath,
      linkedDocumentHash,
      linkedDocumentVersion,
    };
  }

  private async createSignatureCertificate(params: {
    organizationId: string;
    clinicianId: string;
    checklistItemId: string;
    signerName: string;
    signerAccountId: string | null;
    signerIp: string | null;
    signerUserAgent: string | null;
    signerTimezoneOffsetMinutes: number | null;
    signedAt: Date;
    linkedDocumentId: string | null;
    linkedDocumentPath: string | null;
    linkedDocumentHash: string;
    linkedDocumentVersion: number | null;
    agreementText: string;
    signatureHash: string;
    signatureImagePath: string | null;
  }) {
    const certificateId = randomUUID();
    const agreementHash = this.hashText(params.agreementText);
    const certificateStoragePath = `${params.organizationId}/${params.clinicianId}/${params.checklistItemId}/signature-certificate-${certificateId}.json`;
    const certificate = {
      certificateId,
      organizationId: params.organizationId,
      clinicianId: params.clinicianId,
      checklistItemId: params.checklistItemId,
      signer: {
        name: params.signerName,
        accountId: params.signerAccountId,
        ip: params.signerIp,
        userAgent: params.signerUserAgent,
        timezoneOffsetMinutes: params.signerTimezoneOffsetMinutes,
      },
      signedAt: params.signedAt.toISOString(),
      linkedDocument: {
        id: params.linkedDocumentId,
        path: params.linkedDocumentPath,
        hash: params.linkedDocumentHash,
        version: params.linkedDocumentVersion,
      },
      agreementHash,
      signatureHash: params.signatureHash,
      signatureImagePath: params.signatureImagePath,
      issuedAt: new Date().toISOString(),
    };

    const { url: certificateUploadUrl } = await this.storage.getUploadUrlForKey(
      certificateStoragePath,
      'application/json',
    );
    await fetch(certificateUploadUrl, {
      method: 'PUT',
      body: JSON.stringify(certificate, null, 2),
      headers: { 'Content-Type': 'application/json' },
    });

    await this.prisma.$executeRaw`
      INSERT INTO signature_certificates (
        id,
        organization_id,
        clinician_id,
        checklist_item_id,
        signer_name,
        signer_account_id,
        signer_ip,
        signer_user_agent,
        signer_timezone_offset_minutes,
        signed_at,
        linked_document_id,
        linked_document_path,
        linked_document_hash,
        linked_document_version,
        agreement_hash,
        certificate_storage_path,
        certificate_json,
        created_at
      ) VALUES (
        ${certificateId},
        ${params.organizationId},
        ${params.clinicianId},
        ${params.checklistItemId},
        ${params.signerName},
        ${params.signerAccountId},
        ${params.signerIp},
        ${params.signerUserAgent},
        ${params.signerTimezoneOffsetMinutes},
        ${params.signedAt},
        ${params.linkedDocumentId},
        ${params.linkedDocumentPath},
        ${params.linkedDocumentHash},
        ${params.linkedDocumentVersion},
        ${agreementHash},
        ${certificateStoragePath},
        ${JSON.stringify(certificate)}::jsonb,
        NOW()
      )
    `;

    await this.prisma.$executeRaw`
      UPDATE clinician_checklist_items
      SET
        signer_user_agent = ${params.signerUserAgent},
        signer_timezone_offset_minutes = ${params.signerTimezoneOffsetMinutes},
        signature_certificate_path = ${certificateStoragePath}
      WHERE id = ${params.checklistItemId}
    `;

    return {
      certificateId,
      certificateStoragePath,
      certificate,
      agreementHash,
    };
  }

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
    clientUserAgent?: string | null,
  ) {
    const item = await this.prisma.clinicianChecklistItem.findFirst({
      where: { id: itemId, organizationId: user.organizationId },
      include: { itemDefinition: true },
    });

    if (!item) throw new NotFoundException('Checklist item not found');

    if (
      user.entityType === 'clinician' &&
      user.clinicianId &&
      item.clinicianId !== user.clinicianId
    ) {
      throw new ForbiddenException(
        'You can only submit checklist items for your own profile',
      );
    }

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

    let signatureCertificatePath: string | null = null;
    let signatureCertificateId: string | null = null;

    switch (item.itemDefinition.type) {
      case 'file_upload':
        if (!dto.docStoragePath) throw new BadRequestException('File upload required');
        updateData.docStoragePath = dto.docStoragePath;
        updateData.docOriginalName = dto.docOriginalName || null;
        updateData.docMimeType = dto.docMimeType || null;
        if (dto.expiresAt) {
          const expDate = new Date(dto.expiresAt);
          if (expDate < new Date()) {
            throw new BadRequestException('Expiration date cannot be in the past');
          }
          updateData.expiresAt = expDate;
        }
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
        // Enhanced e-signature: typed name + drawn signature + agreement
        if (!dto.signerName) throw new BadRequestException('Signer name is required for e-signature');
        if (!dto.agreement) throw new BadRequestException('Agreement must be accepted for e-signature');
        if (!dto.signatureImage) throw new BadRequestException('Drawn signature is required');

        const AGREEMENT_TEXT = 'I have read and agree to the terms of this document. I understand that this constitutes my legally binding electronic signature.';

        const signatureTimestamp = new Date();
        const signerIp = clientIp || 'unknown';
        const signerUserAgent = clientUserAgent || null;
        const signerTimezoneOffsetMinutes =
          typeof dto.timezoneOffsetMinutes === 'number'
            ? dto.timezoneOffsetMinutes
            : null;
        const signatureHash = createHash('sha256')
          .update(`${dto.signerName}|${item.clinicianId}|${itemId}|${signatureTimestamp.toISOString()}`)
          .digest('hex');

        updateData.valueText = 'signed';
        updateData.signerName = dto.signerName;
        updateData.signatureTimestamp = signatureTimestamp;
        updateData.signerIp = signerIp;
        updateData.signatureHash = signatureHash;
        updateData.agreementText = AGREEMENT_TEXT;
        updateData.status = 'submitted' as ChecklistItemStatus; // requires admin review

        // Upload drawn signature image to S3
        const sigImageKey = `${user.organizationId}/${item.clinicianId}/${itemId}/signature-${randomUUID()}.png`;
        try {
          // Strip data URL prefix: "data:image/png;base64,..." → raw base64
          const base64Data = dto.signatureImage.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          const { url: sigUploadUrl } = await this.storage.getUploadUrlForKey(sigImageKey, 'image/png');
          await fetch(sigUploadUrl, {
            method: 'PUT',
            body: imageBuffer,
            headers: { 'Content-Type': 'image/png' },
          });
          updateData.signatureImagePath = sigImageKey;
        } catch {
          // Non-blocking: image upload failure doesn't prevent signature
          updateData.signatureImagePath = null;
        }

        // Always store a signature receipt (regardless of linked document)
        const receiptKey = `${user.organizationId}/${item.clinicianId}/${itemId}/signature-receipt-${randomUUID()}.json`;
        const receipt = {
          signerName: dto.signerName,
          signatureTimestamp: signatureTimestamp.toISOString(),
          signerIp,
          signatureHash,
          agreementText: AGREEMENT_TEXT,
          signatureImagePath: updateData.signatureImagePath || null,
          itemId,
          clinicianId: item.clinicianId,
          linkedDocumentId: item.itemDefinition.linkedDocumentId || null,
          itemLabel: item.itemDefinition.label,
        };

        const { url: receiptUploadUrl } = await this.storage.getUploadUrlForKey(receiptKey, 'application/json');
        try {
          await fetch(receiptUploadUrl, {
            method: 'PUT',
            body: JSON.stringify(receipt, null, 2),
            headers: { 'Content-Type': 'application/json' },
          });
          updateData.signedDocPath = receiptKey;
        } catch {
          updateData.signedDocPath = null;
        }

        try {
          const linkedEvidence = await this.resolveLinkedDocumentEvidence(
            user.organizationId,
            item.itemDefinition.linkedDocumentId || null,
            AGREEMENT_TEXT,
          );
          const certificate = await this.createSignatureCertificate({
            organizationId: user.organizationId,
            clinicianId: item.clinicianId,
            checklistItemId: itemId,
            signerName: dto.signerName,
            signerAccountId: user.clerkUserId || null,
            signerIp,
            signerUserAgent,
            signerTimezoneOffsetMinutes,
            signedAt: signatureTimestamp,
            linkedDocumentId: linkedEvidence.linkedDocumentId,
            linkedDocumentPath: linkedEvidence.linkedDocumentPath,
            linkedDocumentHash: linkedEvidence.linkedDocumentHash,
            linkedDocumentVersion: linkedEvidence.linkedDocumentVersion,
            agreementText: AGREEMENT_TEXT,
            signatureHash,
            signatureImagePath: updateData.signatureImagePath || null,
          });
          signatureCertificatePath = certificate.certificateStoragePath;
          signatureCertificateId = certificate.certificateId;
        } catch {
          signatureCertificatePath = null;
          signatureCertificateId = null;
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
      actorUserId: user.entityType === 'user' ? user.id : undefined,
      actorRole: user.role,
      clinicianId: item.clinicianId,
      entityType: 'checklist_item',
      entityId: itemId,
      action: 'item_submitted',
      details: {
        type: item.itemDefinition.type,
        label: item.itemDefinition.label,
        signatureCertificatePath,
        signatureCertificateId,
      },
      oldValue: {
        status: item.status,
      },
      newValue: {
        status: updated.status,
      },
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

  async getSignatureCertificate(itemId: string, user: AuthenticatedUser) {
    const item = await this.prisma.clinicianChecklistItem.findFirst({
      where: { id: itemId, organizationId: user.organizationId },
      select: {
        id: true,
        clinicianId: true,
        signerName: true,
        signatureTimestamp: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    if (user.role === 'clinician') {
      if (!user.clinicianId || item.clinicianId !== user.clinicianId) {
        throw new ForbiddenException(
          'You can only access signature certificates for your own profile',
        );
      }
    } else if (!this.isPrivilegedRole(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    type CertificateRow = {
      id: string;
      signer_name: string;
      signer_account_id: string | null;
      signer_ip: string | null;
      signer_user_agent: string | null;
      signer_timezone_offset_minutes: number | null;
      signed_at: Date;
      linked_document_id: string | null;
      linked_document_path: string | null;
      linked_document_hash: string;
      linked_document_version: number | null;
      agreement_hash: string;
      certificate_storage_path: string;
      certificate_json: Record<string, any> | null;
      created_at: Date;
    };

    let rows: CertificateRow[] = [];
    try {
      rows = await this.prisma.$queryRaw<CertificateRow[]>`
        SELECT
          id,
          signer_name,
          signer_account_id,
          signer_ip,
          signer_user_agent,
          signer_timezone_offset_minutes,
          signed_at,
          linked_document_id,
          linked_document_path,
          linked_document_hash,
          linked_document_version,
          agreement_hash,
          certificate_storage_path,
          certificate_json,
          created_at
        FROM signature_certificates
        WHERE checklist_item_id = ${itemId}
          AND organization_id = ${user.organizationId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } catch {
      throw new NotFoundException('Signature certificate not available');
    }

    const cert = rows[0];
    if (!cert) {
      throw new NotFoundException('Signature certificate not found');
    }

    let downloadUrl: string | null = null;
    try {
      const signed = await this.storage.getDownloadUrl(cert.certificate_storage_path);
      downloadUrl = signed.url;
    } catch {
      downloadUrl = null;
    }

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.entityType === 'user' ? user.id : undefined,
      actorRole: user.role,
      clinicianId: item.clinicianId,
      entityType: 'checklist_item',
      entityId: itemId,
      action: 'signature_certificate_exported',
      details: {
        certificateId: cert.id,
        certificateStoragePath: cert.certificate_storage_path,
      },
    });

    return {
      id: cert.id,
      checklistItemId: itemId,
      signerName: cert.signer_name,
      signerAccountId: cert.signer_account_id,
      signerIp: cert.signer_ip,
      signerUserAgent: cert.signer_user_agent,
      signerTimezoneOffsetMinutes: cert.signer_timezone_offset_minutes,
      signedAt: cert.signed_at.toISOString(),
      linkedDocumentId: cert.linked_document_id,
      linkedDocumentPath: cert.linked_document_path,
      linkedDocumentHash: cert.linked_document_hash,
      linkedDocumentVersion: cert.linked_document_version,
      agreementHash: cert.agreement_hash,
      certificateStoragePath: cert.certificate_storage_path,
      certificateJson: cert.certificate_json,
      createdAt: cert.created_at.toISOString(),
      downloadUrl,
    };
  }
}
