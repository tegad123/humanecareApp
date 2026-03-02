import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module.js';
import { OrgDocumentsController } from './org-documents.controller.js';
import { OrgDocumentsService } from './org-documents.service.js';

@Module({
  imports: [StorageModule],
  controllers: [OrgDocumentsController],
  providers: [OrgDocumentsService],
  exports: [OrgDocumentsService],
})
export class OrgDocumentsModule {}
