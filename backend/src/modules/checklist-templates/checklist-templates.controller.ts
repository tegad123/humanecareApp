import { Controller, Get, Param } from '@nestjs/common';
import { ChecklistTemplatesService } from './checklist-templates.service.js';
import { CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly templatesService: ChecklistTemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.templatesService.findAll(authUser.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.templatesService.findOne(id, authUser.organizationId);
  }
}
