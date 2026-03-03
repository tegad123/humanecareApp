import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateOrganizationComplianceSettingsDto } from './dto/update-organization-compliance-settings.dto.js';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite')
  @Roles('super_admin', 'admin')
  invite(@Body() dto: InviteUserDto, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    // Admin can only invite within their own org
    if (authUser.role !== 'super_admin') {
      dto.organizationId = authUser.organizationId;
    }
    return this.usersService.invite(dto, {
      id: authUser.id,
      role: authUser.role,
      organizationId: authUser.organizationId,
    });
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    if (authUser.entityType === 'clinician') {
      return {
        id: authUser.id,
        role: 'clinician',
        email: authUser.email,
        entityType: 'clinician',
        clinicianId: authUser.clinicianId,
        organizationId: authUser.organizationId,
      };
    }
    return this.usersService.findMe(authUser.id);
  }

  @Get()
  @Roles('super_admin', 'admin')
  findAll(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.usersService.findByOrganization(authUser.organizationId);
  }

  @Get('organization-settings')
  @Roles('super_admin', 'admin', 'compliance')
  getOrganizationSettings(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.usersService.getOrganizationComplianceSettings(authUser.organizationId);
  }

  @Patch('organization-settings')
  @Roles('super_admin', 'admin')
  updateOrganizationSettings(
    @Body() dto: UpdateOrganizationComplianceSettingsDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    if (
      dto.requireDualApprovalForHighRiskOverride === undefined &&
      dto.timezone === undefined &&
      dto.retentionDays === undefined
    ) {
      throw new BadRequestException(
        'At least one organization setting must be provided',
      );
    }
    return this.usersService.updateOrganizationComplianceSettings(
      authUser.organizationId,
      {
        requireDualApprovalForHighRiskOverride:
          dto.requireDualApprovalForHighRiskOverride,
        timezone: dto.timezone,
        retentionDays: dto.retentionDays,
      },
      {
        id: authUser.id,
        role: authUser.role,
        organizationId: authUser.organizationId,
      },
    );
  }

  @Patch(':id/role')
  @Roles('super_admin', 'admin')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.usersService.updateRole(id, dto.role, {
      id: authUser.id,
      organizationId: authUser.organizationId,
      role: authUser.role,
    });
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.usersService.remove(id, {
      id: authUser.id,
      organizationId: authUser.organizationId,
      role: authUser.role,
    });
  }
}
