import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module.js';
import { TemplateDocumentsController } from './template-documents.controller.js';
import { TemplateDocumentsService } from './template-documents.service.js';

@Module({
  imports: [StorageModule],
  controllers: [TemplateDocumentsController],
  providers: [TemplateDocumentsService],
  exports: [TemplateDocumentsService],
})
export class TemplateDocumentsModule {}
