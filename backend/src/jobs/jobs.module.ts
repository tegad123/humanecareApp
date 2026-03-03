import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CliniciansModule } from '../modules/clinicians/clinicians.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { EmailService } from './email.service.js';
import { ExpirationJobService } from './expiration-job.service.js';
import { ReminderJobService } from './reminder-job.service.js';
import { JobRunsService } from './job-runs.service.js';
import { JobsController } from './jobs.controller.js';
import { DataRetentionJobService } from './data-retention-job.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => CliniciansModule),
    StorageModule,
  ],
  controllers: [JobsController],
  providers: [
    EmailService,
    JobRunsService,
    ExpirationJobService,
    ReminderJobService,
    DataRetentionJobService,
  ],
  exports: [EmailService, JobRunsService],
})
export class JobsModule {}
