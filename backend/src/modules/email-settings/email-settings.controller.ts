import { Controller, Get, Put, Body } from '@nestjs/common';
import { EmailSettingsService } from './email-settings.service.js';
import { UpsertEmailSettingsDto } from './dto/upsert-email-settings.dto.js';
import { Roles } from '../../auth/decorators/index.js';
import { CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('email-settings')
export class EmailSettingsController {
  constructor(private readonly service: EmailSettingsService) {}

  @Get()
  @Roles('super_admin', 'admin')
  get(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.get(authUser.organizationId);
  }

  @Get('defaults')
  @Roles('super_admin', 'admin')
  getDefaults() {
    return this.service.getDefaults();
  }

  @Put()
  @Roles('super_admin', 'admin')
  upsert(
    @Body() dto: UpsertEmailSettingsDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.upsert(authUser.organizationId, dto, authUser);
  }
}
