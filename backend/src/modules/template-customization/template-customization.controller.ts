import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { TemplateCustomizationService } from './template-customization.service.js';
import { CloneTemplateDto } from './dto/clone-template.dto.js';
import { CreateItemDefinitionDto } from './dto/create-item-definition.dto.js';
import { UpdateItemDefinitionDto } from './dto/update-item-definition.dto.js';
import { ReorderItemsDto } from './dto/reorder-items.dto.js';
import { Roles } from '../../auth/decorators/index.js';
import { CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('templates')
export class TemplateCustomizationController {
  constructor(private readonly service: TemplateCustomizationService) {}

  @Post(':id/clone')
  @Roles('super_admin', 'admin')
  clone(
    @Param('id') id: string,
    @Body() dto: CloneTemplateDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.cloneTemplate(id, authUser, dto.name);
  }

  @Patch(':templateId/items/reorder')
  @Roles('super_admin', 'admin')
  reorder(
    @Param('templateId') templateId: string,
    @Body() dto: ReorderItemsDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.reorderItems(templateId, dto.orderedIds, authUser);
  }

  @Patch(':templateId/items/:defId')
  @Roles('super_admin', 'admin')
  updateItem(
    @Param('defId') defId: string,
    @Body() dto: UpdateItemDefinitionDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.updateItemDefinition(defId, dto, authUser);
  }

  @Post(':templateId/items')
  @Roles('super_admin', 'admin')
  createItem(
    @Param('templateId') templateId: string,
    @Body() dto: CreateItemDefinitionDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.createItemDefinition(templateId, dto, authUser);
  }

  @Delete(':templateId/items/:defId')
  @Roles('super_admin', 'admin')
  deleteItem(
    @Param('defId') defId: string,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.deleteItemDefinition(defId, authUser);
  }
}
