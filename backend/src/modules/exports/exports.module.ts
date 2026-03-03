import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';
import { StorageModule } from '../../storage/storage.module.js';

@Module({
  imports: [StorageModule],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
