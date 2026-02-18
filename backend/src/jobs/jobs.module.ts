import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CliniciansModule } from '../modules/clinicians/clinicians.module.js';
import { EmailService } from './email.service.js';
import { ExpirationJobService } from './expiration-job.service.js';
import { ReminderJobService } from './reminder-job.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CliniciansModule,
  ],
  providers: [EmailService, ExpirationJobService, ReminderJobService],
  exports: [EmailService],
})
export class JobsModule {}
