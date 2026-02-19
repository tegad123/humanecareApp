import { Module } from '@nestjs/common';
import { TemplateCustomizationController } from './template-customization.controller.js';
import { TemplateCustomizationService } from './template-customization.service.js';

@Module({
  controllers: [TemplateCustomizationController],
  providers: [TemplateCustomizationService],
  exports: [TemplateCustomizationService],
})
export class TemplateCustomizationModule {}
