import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
  ForbiddenException,
  StreamableFile,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service.js';
import { CurrentUser, Roles } from '../auth/decorators/index.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service.js';

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private isPrivilegedStorageRole(role: string) {
    return ['super_admin', 'admin', 'recruiter', 'compliance'].includes(role);
  }

  private async assertKeyAccess(
    authUser: AuthenticatedUser,
    key: string,
    options?: { allowClinician?: boolean },
  ) {
    if (!key.startsWith(`${authUser.organizationId}/`)) {
      throw new BadRequestException('Access denied to this file');
    }

    const checklistItem = await this.prisma.clinicianChecklistItem.findFirst({
      where: {
        organizationId: authUser.organizationId,
        OR: [
          { docStoragePath: key },
          { signedDocPath: key },
          { signatureImagePath: key },
        ],
      },
      select: { id: true, clinicianId: true },
    });

    if (checklistItem) {
      if (authUser.role === 'clinician') {
        if (!options?.allowClinician) {
          throw new ForbiddenException('Clinician access is not allowed for this endpoint');
        }
        if (!authUser.clinicianId || authUser.clinicianId !== checklistItem.clinicianId) {
          throw new ForbiddenException('You can only access your own files');
        }
        return;
      }
      if (!this.isPrivilegedStorageRole(authUser.role)) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return;
    }

    const templateDoc = await this.prisma.templateDocument.findFirst({
      where: {
        organizationId: authUser.organizationId,
        storagePath: key,
      },
      select: { id: true },
    });

    if (templateDoc) {
      if (!this.isPrivilegedStorageRole(authUser.role)) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return;
    }

    throw new BadRequestException('Access denied to this file');
  }

  @Post('upload-url')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'clinician')
  async getUploadUrl(
    @CurrentUser() user: any,
    @Body() body: { clinicianId: string; itemId: string; fileName: string; contentType: string },
  ) {
    const authUser = user as AuthenticatedUser;
    if (!body.fileName || !body.contentType || !body.clinicianId || !body.itemId) {
      throw new BadRequestException('Missing required fields: clinicianId, itemId, fileName, contentType');
    }

    // Validate content type against allowlist
    if (!ALLOWED_CONTENT_TYPES.has(body.contentType)) {
      throw new BadRequestException(
        `File type "${body.contentType}" is not allowed. Accepted types: PDF, JPEG, PNG, DOC, DOCX.`,
      );
    }

    // Validate file name length
    if (body.fileName.length > 255) {
      throw new BadRequestException('File name must not exceed 255 characters');
    }

    // Clinician ownership check: if the caller is a clinician, they can only
    // upload for themselves (authUser.clinicianId is set by the auth guard).
    if (
      authUser.entityType === 'clinician' &&
      authUser.clinicianId &&
      body.clinicianId !== authUser.clinicianId
    ) {
      throw new BadRequestException('You can only upload files for your own checklist items');
    }

    const checklistItem = await this.prisma.clinicianChecklistItem.findFirst({
      where: {
        id: body.itemId,
        organizationId: authUser.organizationId,
        clinicianId: body.clinicianId,
      },
      select: { id: true },
    });

    if (!checklistItem) {
      throw new BadRequestException('Invalid clinicianId/itemId combination');
    }

    return this.storageService.getUploadUrl({
      organizationId: authUser.organizationId,
      clinicianId: body.clinicianId,
      itemId: body.itemId,
      fileName: body.fileName,
      contentType: body.contentType,
    });
  }

  @Get('download-url')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'clinician')
  async getDownloadUrl(
    @CurrentUser() user: any,
    @Query('key') key: string,
  ) {
    const authUser = user as AuthenticatedUser;
    if (!key) {
      throw new BadRequestException('Missing required query parameter: key');
    }
    await this.assertKeyAccess(authUser, key, { allowClinician: true });

    await this.auditLogs.log({
      organizationId: authUser.organizationId,
      actorUserId: authUser.entityType === 'user' ? authUser.id : undefined,
      actorRole: authUser.role as any,
      clinicianId: authUser.entityType === 'clinician' ? authUser.clinicianId : undefined,
      entityType: 'storage_file',
      entityId: key,
      action: 'storage_download_url_requested',
      details: {
        endpoint: 'storage/download-url',
      },
    });

    return this.storageService.getDownloadUrl(key);
  }

  @Get('file')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance')
  async getFile(
    @CurrentUser() user: any,
    @Query('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authUser = user as AuthenticatedUser;
    if (!key) {
      throw new BadRequestException('Missing required query parameter: key');
    }
    await this.assertKeyAccess(authUser, key, { allowClinician: false });

    await this.auditLogs.log({
      organizationId: authUser.organizationId,
      actorUserId: authUser.entityType === 'user' ? authUser.id : undefined,
      actorRole: authUser.role as any,
      entityType: 'storage_file',
      entityId: key,
      action: 'storage_file_downloaded',
      details: {
        endpoint: 'storage/file',
      },
    });

    try {
      const file = await this.storageService.getFile(key);
      const fileName = key.split('/').pop() || 'document';

      if (file.contentType) {
        res.setHeader('Content-Type', file.contentType);
      }
      if (file.contentLength) {
        res.setHeader('Content-Length', String(file.contentLength));
      }
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"`,
      );
      res.setHeader('Cache-Control', 'private, no-store');

      return new StreamableFile(file.buffer);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
