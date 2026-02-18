import { Module, forwardRef } from '@nestjs/common';
import { CliniciansController } from './clinicians.controller.js';
import { CliniciansService } from './clinicians.service.js';
import { ReadyToStaffService } from './ready-to-staff.service.js';
import { ChecklistTemplatesModule } from '../checklist-templates/checklist-templates.module.js';
import { ChecklistItemsModule } from '../checklist-items/checklist-items.module.js';

@Module({
  imports: [ChecklistTemplatesModule, forwardRef(() => ChecklistItemsModule)],
  controllers: [CliniciansController],
  providers: [CliniciansService, ReadyToStaffService],
  exports: [CliniciansService, ReadyToStaffService],
})
export class CliniciansModule {}
