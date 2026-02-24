import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
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
    return this.usersService.invite(dto);
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
