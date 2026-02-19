import { Module } from '@nestjs/common';
import { AccessRequestsController } from './access-requests.controller.js';
import { AccessRequestsService } from './access-requests.service.js';
import { JobsModule } from '../../jobs/jobs.module.js';

@Module({
  imports: [JobsModule],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService],
  exports: [AccessRequestsService],
})
export class AccessRequestsModule {}
