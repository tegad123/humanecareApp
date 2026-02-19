import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AccessRequestsService } from './access-requests.service.js';
import { CreateAccessRequestDto } from './dto/create-access-request.dto.js';
import { Public, Roles } from '../../auth/decorators/index.js';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Post()
  @Public()
  create(@Body() dto: CreateAccessRequestDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('super_admin')
  findAll(@Query('status') status?: string) {
    return this.service.findAll({ status });
  }

  @Get(':id')
  @Roles('super_admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @Roles('super_admin')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.service.updateStatus(id, status, reviewNotes);
  }
}
