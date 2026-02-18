import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ChecklistItemsService } from './checklist-items.service.js';
import { SubmitItemDto } from './dto/submit-item.dto.js';
import { ReviewItemDto } from './dto/review-item.dto.js';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('checklist-items')
export class ChecklistItemsController {
  constructor(private readonly checklistItemsService: ChecklistItemsService) {}

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitItemDto,
    @CurrentUser() user: any,
  ) {
    return this.checklistItemsService.submit(id, dto, user as AuthenticatedUser);
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
