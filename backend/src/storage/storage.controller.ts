import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { CurrentUser } from '../auth/decorators/index.js';
import type { AuthenticatedUser } from '../common/interfaces.js';

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
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
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

    return this.storageService.getUploadUrl({
      organizationId: authUser.organizationId,
      clinicianId: body.clinicianId,
      itemId: body.itemId,
      fileName: body.fileName,
      contentType: body.contentType,
    });
  }

  @Get('download-url')
  async getDownloadUrl(
    @CurrentUser() user: any,
    @Query('key') key: string,
  ) {
    const authUser = user as AuthenticatedUser;
    if (!key) {
      throw new BadRequestException('Missing required query parameter: key');
    }
    // Ensure the key belongs to the user's organization
    if (!key.startsWith(authUser.organizationId + '/')) {
      throw new BadRequestException('Access denied to this file');
    }

    return this.storageService.getDownloadUrl(key);
  }
}
