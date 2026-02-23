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
