import { Module, forwardRef } from '@nestjs/common';
import { ChecklistItemsController } from './checklist-items.controller.js';
import { ChecklistItemsService } from './checklist-items.service.js';
import { CliniciansModule } from '../clinicians/clinicians.module.js';

@Module({
  imports: [forwardRef(() => CliniciansModule)],
  controllers: [ChecklistItemsController],
  providers: [ChecklistItemsService],
  exports: [ChecklistItemsService],
})
export class ChecklistItemsModule {}
