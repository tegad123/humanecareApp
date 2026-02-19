import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ChecklistItemsService } from './checklist-items.service.js';
import { SubmitItemDto } from './dto/submit-item.dto.js';
import { ReviewItemDto } from './dto/review-item.dto.js';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import type { Request } from 'express';

@Controller('checklist-items')
export class ChecklistItemsController {
  constructor(private readonly checklistItemsService: ChecklistItemsService) {}

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitItemDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    return this.checklistItemsService.submit(id, dto, user as AuthenticatedUser, clientIp);
  }

  @Patch(':id/review')
  @Roles('super_admin', 'admin', 'compliance')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewItemDto,
    @CurrentUser() user: any,
  ) {
    return this.checklistItemsService.review(id, dto, user as AuthenticatedUser);
  }
}
