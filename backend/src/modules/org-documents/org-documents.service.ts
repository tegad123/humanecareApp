import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateOrgDocumentDto } from './dto/create-org-document.dto.js';
import { UpdateOrgDocumentDto } from './dto/update-org-document.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { randomUUID } from 'crypto';

@Injectable()
export class OrgDocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private auditLogs: AuditLogsService,
  ) {}

  /**
   * Create an org-level document record and return a presigned upload URL.
   * Org documents have templateId = null and are reusable across all templates.
   */
  async upload(dto: CreateOrgDocumentDto, user: AuthenticatedUser) {
    const key = `${user.organizationId}/org-documents/${randomUUID()}-${dto.fileName}`;

    const doc = await this.prisma.templateDocument.create({
      data: {
        organizationId: user.organizationId,
        templateId: null, // Org-level document
        name: dto.name,
        category: dto.category || 'other',
        description: dto.description || null,
        storagePath: key,
        mimeType: dto.contentType,
        fileSizeBytes: dto.fileSizeBytes,
      },
    });

    const { url } = await this.storage.getUploadUrlForKey(key, dto.contentType);

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'org_document',
      entityId: doc.id,
      action: 'org_document_uploaded',
      details: { name: dto.name, category: dto.category || 'other' },
    });

    return { document: doc, uploadUrl: url };
  }

  /**
   * List all org-level documents (templateId IS NULL) for an organization.
   */
  async list(organizationId: string) {
    return this.prisma.templateDocument.findMany({
      where: { organizationId, templateId: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a count of org-level documents for the setup guide.
   */
  async count(organizationId: string): Promise<number> {
    return this.prisma.templateDocument.count({
      where: { organizationId, templateId: null },
    });
  }

  /**
   * Update an org-level document's metadata.
   */
  async update(docId: string, dto: UpdateOrgDocumentDto, user: AuthenticatedUser) {
    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId: user.organizationId, templateId: null },
    });
    if (!doc) throw new NotFoundException('Organization document not found');

    const updated = await this.prisma.templateDocument.update({
      where: { id: docId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'org_document',
      entityId: docId,
      action: 'org_document_updated',
      details: { name: updated.name, changes: dto },
    });

    return updated;
  }

  /**
   * Get a presigned download URL for an org document.
   */
  async getDownloadUrl(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId: user.organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.entityType === 'user' ? user.id : undefined,
      actorRole: user.role as any,
      entityType: 'org_document',
      entityId: docId,
      action: 'org_document_downloaded',
      details: {
        name: doc.name,
      },
    });

    const { url } = await this.storage.getDownloadUrl(doc.storagePath);
    return { url, name: doc.name, mimeType: doc.mimeType };
  }

  /**
   * Get a download URL accessible by clinicians (for linked file_upload / e-signature items).
   */
  async getClinicianDownloadUrl(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId: user.organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (user.role === 'clinician') {
      const linkedItem = await this.prisma.clinicianChecklistItem.findFirst({
        where: {
          organizationId: user.organizationId,
          clinicianId: user.clinicianId,
          itemDefinition: {
            linkedDocumentId: docId,
          },
        },
        select: { id: true },
      });
      if (!linkedItem) {
        throw new ForbiddenException('Access denied to this document');
      }
    }

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.entityType === 'user' ? user.id : undefined,
      actorRole: user.role as any,
      clinicianId: user.role === 'clinician' ? user.clinicianId : undefined,
      entityType: 'org_document',
      entityId: docId,
      action: 'org_document_clinician_downloaded',
      details: {
        name: doc.name,
      },
    });

    const { url } = await this.storage.getDownloadUrl(doc.storagePath);
    return { url, name: doc.name, mimeType: doc.mimeType };
  }

  /**
   * Delete an org-level document and unlink it from any item definitions.
   */
  async delete(docId: string, user: AuthenticatedUser) {
    const legalHoldRows = await this.prisma.$queryRaw<Array<{ cnt: number }>>`
      SELECT COUNT(*)::int AS cnt
      FROM legal_holds
      WHERE organization_id = ${user.organizationId}
        AND active = true
    `;
    if ((legalHoldRows[0]?.cnt || 0) > 0) {
      throw new ForbiddenException(
        'Deletion is blocked while an active legal hold exists for this organization.',
      );
    }

    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId: user.organizationId, templateId: null },
    });
    if (!doc) throw new NotFoundException('Organization document not found');

    await this.prisma.$transaction([
      // Unlink from any item definitions
      this.prisma.checklistItemDefinition.updateMany({
        where: { linkedDocumentId: docId },
        data: { linkedDocumentId: null },
      }),
      // Delete the document record
      this.prisma.templateDocument.delete({
        where: { id: docId },
      }),
    ]);

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'org_document',
      entityId: docId,
      action: 'org_document_deleted',
      details: { name: doc.name },
    });

    return { success: true };
  }
}
