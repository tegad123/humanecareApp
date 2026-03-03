import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { ExportsService } from './exports.service.js';
import { CreateLegalHoldDto } from './dto/create-legal-hold.dto.js';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto.js';
import { UpdateCorrectiveActionDto } from './dto/update-corrective-action.dto.js';
import { AcceptPolicyDto } from './dto/accept-policy.dto.js';

@Controller('exports')
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Post('org')
  @Roles('super_admin', 'admin', 'compliance')
  createOrgExport(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.createOrgExport(authUser.organizationId, authUser);
  }

  @Get()
  @Roles('super_admin', 'admin', 'compliance')
  listOrgExports(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.listExportJobs(authUser.organizationId);
  }

  @Get('legal-holds')
  @Roles('super_admin', 'admin', 'compliance')
  listLegalHolds(
    @CurrentUser() user: any,
    @Query('activeOnly', new ParseBoolPipe({ optional: true })) activeOnly?: boolean,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.listLegalHolds(authUser.organizationId, Boolean(activeOnly));
  }

  @Post('legal-holds')
  @Roles('super_admin', 'admin', 'compliance')
  createLegalHold(@CurrentUser() user: any, @Body() dto: CreateLegalHoldDto) {
    const authUser = user as AuthenticatedUser;
    return this.service.createLegalHold(authUser.organizationId, dto, authUser);
  }

  @Post('legal-holds/:id/release')
  @Roles('super_admin', 'admin', 'compliance')
  releaseLegalHold(@CurrentUser() user: any, @Param('id') id: string) {
    const authUser = user as AuthenticatedUser;
    return this.service.releaseLegalHold(authUser.organizationId, id, authUser);
  }

  @Get('qapi/summary')
  @Roles('super_admin', 'admin', 'compliance')
  getQapiSummary(
    @CurrentUser() user: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.getQapiSummary(authUser.organizationId, days || 90);
  }

  @Get('qapi/trends')
  @Roles('super_admin', 'admin', 'compliance')
  getQapiTrends(
    @CurrentUser() user: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.getQapiTrends(authUser.organizationId, days || 90);
  }

  @Get('corrective-actions')
  @Roles('super_admin', 'admin', 'compliance')
  listCorrectiveActions(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.listCorrectiveActions(authUser.organizationId);
  }

  @Post('corrective-actions')
  @Roles('super_admin', 'admin', 'compliance')
  createCorrectiveAction(
    @CurrentUser() user: any,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.createCorrectiveAction(authUser.organizationId, dto, authUser);
  }

  @Patch('corrective-actions/:id')
  @Roles('super_admin', 'admin', 'compliance')
  updateCorrectiveAction(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCorrectiveActionDto,
  ) {
    const authUser = user as AuthenticatedUser;
    return this.service.updateCorrectiveAction(authUser.organizationId, id, dto, authUser);
  }

  @Get('policies')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'scheduler', 'payroll')
  getPolicies(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    return this.service.getPolicyDocuments(authUser.organizationId, authUser.id);
  }

  @Post('policies/accept')
  @Roles('super_admin', 'admin', 'recruiter', 'compliance', 'scheduler', 'payroll')
  acceptPolicy(@CurrentUser() user: any, @Body() dto: AcceptPolicyDto) {
    const authUser = user as AuthenticatedUser;
    return this.service.acceptPolicy(authUser.organizationId, dto, authUser);
  }

  @Get(':id')
  @Roles('super_admin', 'admin', 'compliance')
  getExport(@CurrentUser() user: any, @Param('id') id: string) {
    const authUser = user as AuthenticatedUser;
    return this.service.getExportJob(authUser.organizationId, id);
  }
}
