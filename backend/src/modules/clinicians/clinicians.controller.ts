import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CliniciansService } from './clinicians.service.js';
import { ReadyToStaffService } from './ready-to-staff.service.js';
import { ChecklistItemsService } from '../checklist-items/checklist-items.service.js';
import { CreateClinicianDto } from './dto/create-clinician.dto.js';
import { UpdateClinicianDto } from './dto/update-clinician.dto.js';
import { SetOverrideDto } from './dto/set-override.dto.js';
import { Roles, CurrentUser, Public } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { ClinicianStatus } from '../../../generated/prisma/client.js';

@Controller('clinicians')
export class CliniciansController {
  constructor(
    private readonly cliniciansService: CliniciansService,
    private readonly readyToStaffService: ReadyToStaffService,
    private readonly checklistItemsService: ChecklistItemsService,
  ) {}

  @Post()
  @Roles('super_admin', 'admin', 'recruiter')
  create(@Body() dto: CreateClinicianDto, @CurrentUser() user: any) {
    return this.cliniciansService.create(dto, user as AuthenticatedUser);
  }

  @Get('me')
  @Roles('clinician')
  getMyProfile(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.findByClerkUser(authUser.clerkUserId);
  }

  @Get('me/checklist')
  @Roles('clinician')
  async getMyChecklist(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    const clinician = await this.cliniciansService.findByClerkUser(
      authUser.clerkUserId,
    );
    return this.checklistItemsService.findByClinician(
      clinician.id,
      clinician.organizationId,
    );
  }

  @Get('me/progress')
  @Roles('clinician')
  async getMyProgress(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    const clinician = await this.cliniciansService.findByClerkUser(
      authUser.clerkUserId,
    );
    return this.cliniciansService.getProgress(
      clinician.id,
      clinician.organizationId,
    );
  }

  @Get('stats')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'scheduler')
  getStats(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.getStats(authUser.organizationId);
  }

  @Get('expiring-items')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'scheduler')
  getExpiringItems(
    @CurrentUser() user: any,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.getExpiringItems(authUser.organizationId, {
      daysAhead: days ? parseInt(days, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ── Public Invite Endpoints ──────────────────────────────────

  @Get('invite/:token/validate')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validateInvite(@Param('token') token: string) {
    return this.cliniciansService.validateInviteToken(token);
  }

  @Post('invite/:token/accept')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  acceptInvite(
    @Param('token') token: string,
    @Body('clerkUserId') clerkUserId: string,
  ) {
    if (!clerkUserId) {
      throw new BadRequestException('clerkUserId is required');
    }
    return this.cliniciansService.linkClerkUser(token, clerkUserId);
  }

  // ── Authenticated Endpoints ─────────────────────────────────

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('discipline') discipline?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.findAll(authUser.organizationId, {
      status,
      discipline,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post(':id/override')
  @Roles('super_admin', 'admin')
  async setOverride(
    @Param('id') id: string,
    @Body() dto: SetOverrideDto,
    @CurrentUser() user: any,
  ) {
    const authUser = user as AuthenticatedUser;
    // Validate clinician belongs to org
    await this.cliniciansService.findOne(id, authUser.organizationId);
    const overrideValue = (dto.overrideValue || 'ready') as ClinicianStatus;
    try {
      return await this.readyToStaffService.setOverride(
        id,
        authUser.organizationId,
        overrideValue,
        dto.reason,
        dto.expiresInHours,
        authUser.id,
        authUser.role,
      );
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Delete(':id/override')
  @Roles('super_admin', 'admin')
  async clearOverride(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    await this.cliniciansService.findOne(id, authUser.organizationId);
    const newStatus = await this.readyToStaffService.clearOverride(
      id,
      authUser.organizationId,
      authUser.id,
      authUser.role,
    );
    return { status: newStatus, overrideActive: false };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.findOne(id, authUser.organizationId);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin', 'recruiter')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicianDto,
    @CurrentUser() user: any,
  ) {
    return this.cliniciansService.update(id, dto, user as AuthenticatedUser);
  }

  @Get(':id/checklist')
  getChecklist(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.checklistItemsService.findByClinician(
      id,
      authUser.organizationId,
    );
  }

  @Get(':id/progress')
  getProgress(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.getProgress(id, authUser.organizationId);
  }

  @Get(':id/files')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance')
  getFiles(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.getFiles(id, authUser.organizationId);
  }

  @Get(':id/notes')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance')
  getNotes(@Param('id') id: string, @CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.cliniciansService.getNotes(id, authUser.organizationId);
  }

  @Post(':id/notes')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance')
  addNote(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.cliniciansService.addNote(
      id,
      content,
      user as AuthenticatedUser,
    );
  }

  @Post(':id/resend-invite')
  @Roles('super_admin', 'admin', 'recruiter')
  resendInvite(@Param('id') id: string, @CurrentUser() user: any) {
    return this.cliniciansService.resendInvite(id, user as AuthenticatedUser);
  }
}
