import { Module, forwardRef } from '@nestjs/common';
import { DocumentScannerController } from './document-scanner.controller.js';
import { DocumentScannerService } from './document-scanner.service.js';
import { AiScannerService } from './ai-scanner.service.js';
import { StorageModule } from '../../storage/storage.module.js';
import { CliniciansModule } from '../clinicians/clinicians.module.js';

@Module({
  imports: [StorageModule, forwardRef(() => CliniciansModule)],
  controllers: [DocumentScannerController],
  providers: [DocumentScannerService, AiScannerService],
  exports: [DocumentScannerService],
})
export class DocumentScannerModule {}
