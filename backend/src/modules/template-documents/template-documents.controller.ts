import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { TemplateDocumentsService } from './template-documents.service.js';
import { CreateTemplateDocumentDto } from './dto/create-template-document.dto.js';
import { Roles } from '../../auth/decorators/index.js';
import { CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('templates')
export class TemplateDocumentsController {
  constructor(private readonly service: TemplateDocumentsService) {}

  @Post(':templateId/documents')
  @Roles('super_admin', 'admin')
  upload(
    @Param('templateId') templateId: string,
    @Body() dto: CreateTemplateDocumentDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.upload(templateId, dto, authUser);
  }

  @Get(':templateId/documents')
  listDocuments(
    @Param('templateId') templateId: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.list(templateId, authUser.organizationId);
  }

  @Get(':templateId/documents/:docId/download')
  getDownloadUrl(
    @Param('docId') docId: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.getDownloadUrl(docId, authUser);
  }

  @Get(':templateId/documents/:docId/clinician-download')
  getClinicianDownloadUrl(
    @Param('docId') docId: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.getClinicianDownloadUrl(docId, authUser.organizationId);
  }

  @Delete(':templateId/documents/:docId')
  @Roles('super_admin', 'admin')
  deleteDocument(
    @Param('docId') docId: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.delete(docId, authUser);
  }
}
