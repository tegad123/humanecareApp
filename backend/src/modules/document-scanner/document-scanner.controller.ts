import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { DocumentScannerService } from './document-scanner.service.js';
import { CreateBulkUploadDto } from './dto/create-bulk-upload.dto.js';
import { UpdateDocumentMatchDto } from './dto/update-document-match.dto.js';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('document-scanner')
export class DocumentScannerController {
  constructor(private readonly service: DocumentScannerService) {}

  @Post('bulk-upload')
  @Roles('super_admin', 'admin', 'compliance')
  createBulkUpload(
    @Body() dto: CreateBulkUploadDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createBulkUpload(dto, user as AuthenticatedUser);
  }

  @Post('bulk-upload/:jobId/confirm-uploads')
  @Roles('super_admin', 'admin', 'compliance')
  confirmUploads(
    @Param('jobId') jobId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.confirmUploads(jobId, user as AuthenticatedUser);
  }

  @Get('bulk-upload')
  @Roles('super_admin', 'admin', 'compliance')
  listJobs(@CurrentUser() user: any) {
    return this.service.listJobs(user as AuthenticatedUser);
  }

  @Get('bulk-upload/:jobId')
  @Roles('super_admin', 'admin', 'compliance')
  getJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getJob(jobId, user as AuthenticatedUser);
  }

  @Patch('bulk-upload/:jobId/documents/:docId')
  @Roles('super_admin', 'admin', 'compliance')
  updateDocumentMatch(
    @Param('jobId') jobId: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateDocumentMatchDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateDocumentMatch(jobId, docId, dto, user as AuthenticatedUser);
  }

  @Post('bulk-upload/:jobId/commit')
  @Roles('super_admin', 'admin', 'compliance')
  commitBulkUpload(
    @Param('jobId') jobId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.commitBulkUpload(jobId, user as AuthenticatedUser);
  }
}
