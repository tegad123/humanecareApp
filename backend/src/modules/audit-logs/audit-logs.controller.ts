import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service.js';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles('super_admin', 'admin', 'compliance')
  findAll(
    @CurrentUser() user: any,
    @Query('clinicianId') clinicianId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.auditLogsService.findByOrganization(authUser.organizationId, {
      clinicianId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
