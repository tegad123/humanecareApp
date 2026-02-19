import { Module } from '@nestjs/common';
import { EmailSettingsController } from './email-settings.controller.js';
import { EmailSettingsService } from './email-settings.service.js';

@Module({
  controllers: [EmailSettingsController],
  providers: [EmailSettingsService],
  exports: [EmailSettingsService],
})
export class EmailSettingsModule {}
