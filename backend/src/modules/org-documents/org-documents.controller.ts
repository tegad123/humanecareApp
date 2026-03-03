import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { OrgDocumentsService } from './org-documents.service.js';
import { CreateOrgDocumentDto } from './dto/create-org-document.dto.js';
import { UpdateOrgDocumentDto } from './dto/update-org-document.dto.js';
import { Roles } from '../../auth/decorators/index.js';
import { CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('org-documents')
export class OrgDocumentsController {
  constructor(private readonly service: OrgDocumentsService) {}

  @Post()
  @Roles('super_admin', 'admin')
  upload(
    @Body() dto: CreateOrgDocumentDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.upload(dto, authUser);
  }

  @Get()
  @Roles('super_admin', 'admin', 'compliance')
  list(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.list(authUser.organizationId);
  }

  @Get('count')
  @Roles('super_admin', 'admin', 'compliance')
  count(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.count(authUser.organizationId);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgDocumentDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.update(id, dto, authUser);
  }

  @Get(':id/download')
  @Roles('super_admin', 'admin', 'compliance')
  getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.getDownloadUrl(id, authUser);
  }

  @Get(':id/clinician-download')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'clinician')
  getClinicianDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.getClinicianDownloadUrl(id, authUser);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.delete(id, authUser);
  }
}
