import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateTemplateDocumentDto } from './dto/create-template-document.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { randomUUID } from 'crypto';

@Injectable()
export class TemplateDocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private auditLogs: AuditLogsService,
  ) {}

  private async validateTemplateAccess(templateId: string, organizationId: string) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId, isCustomized: true },
    });
    if (!template) {
      throw new ForbiddenException('Can only manage documents on your organization\'s customized templates');
    }
    return template;
  }

  /**
   * Create a template document record and return a presigned upload URL.
   */
  async upload(
    templateId: string,
    dto: CreateTemplateDocumentDto,
    user: AuthenticatedUser,
  ) {
    await this.validateTemplateAccess(templateId, user.organizationId);

    const key = `${user.organizationId}/templates/${templateId}/docs/${randomUUID()}-${dto.fileName}`;

    const doc = await this.prisma.templateDocument.create({
      data: {
        organizationId: user.organizationId,
        templateId,
        name: dto.name,
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
      entityType: 'template_document',
      entityId: doc.id,
      action: 'template_document_uploaded',
      details: { name: dto.name, templateId },
    });

    return { document: doc, uploadUrl: url };
  }

  /**
   * List all documents for a template.
   */
  async list(templateId: string, organizationId: string) {
    return this.prisma.templateDocument.findMany({
      where: { templateId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a presigned download URL for a template document.
   */
  async getDownloadUrl(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId: user.organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const { url } = await this.storage.getDownloadUrl(doc.storagePath);
    return { url, name: doc.name, mimeType: doc.mimeType };
  }

  /**
   * Get a download URL accessible by clinicians (for linked e-signature documents).
   */
  async getClinicianDownloadUrl(docId: string, organizationId: string) {
    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const { url } = await this.storage.getDownloadUrl(doc.storagePath);
    return { url, name: doc.name, mimeType: doc.mimeType };
  }

  /**
   * Delete a template document and unlink it from any item definitions.
   */
  async delete(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.templateDocument.findFirst({
      where: { id: docId, organizationId: user.organizationId },
      include: { template: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (!doc.template.isCustomized || doc.template.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot delete documents from templates you don\'t own');
    }

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
      entityType: 'template_document',
      entityId: docId,
      action: 'template_document_deleted',
      details: { name: doc.name, templateId: doc.templateId },
    });

    return { success: true };
  }
}
