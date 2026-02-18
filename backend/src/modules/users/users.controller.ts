import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
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
}
