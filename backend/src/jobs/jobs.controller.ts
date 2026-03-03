import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators/index.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobRunsService } from './job-runs.service.js';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobRuns: JobRunsService,
  ) {}

  @Get('reminder-health')
  @Roles('super_admin', 'admin', 'compliance')
  async getReminderHealth(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    const rows = await this.prisma.$queryRaw<Array<{ timezone: string | null }>>`
      SELECT timezone
      FROM organizations
      WHERE id = ${authUser.organizationId}
      LIMIT 1
    `;
    const timezone = rows[0]?.timezone || null;
    return this.jobRuns.getReminderHealth(authUser.organizationId, timezone);
  }

  @Get('retention-health')
  @Roles('super_admin', 'admin', 'compliance')
  async getRetentionHealth(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    const [orgRows, retentionRows, accessRows, holdRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          access_mode: 'active' | 'read_only' | 'suspended';
          grace_period_ends_at: Date | null;
          retention_days: number;
        }>
      >`
        SELECT access_mode, grace_period_ends_at, retention_days
        FROM organizations
        WHERE id = ${authUser.organizationId}
        LIMIT 1
      `,
      this.prisma.$queryRaw<
        Array<{
          id: string;
          status: string;
          started_at: Date;
          finished_at: Date | null;
          processed_count: number;
          success_count: number;
          failure_count: number;
          error_message: string | null;
        }>
      >`
        SELECT
          id,
          status,
          started_at,
          finished_at,
          processed_count,
          success_count,
          failure_count,
          error_message
        FROM job_runs
        WHERE job_name = 'data-retention-cleanup'
          AND (organization_id = ${authUser.organizationId} OR organization_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      this.prisma.$queryRaw<
        Array<{
          id: string;
          status: string;
          started_at: Date;
          finished_at: Date | null;
          processed_count: number;
          success_count: number;
          failure_count: number;
          error_message: string | null;
        }>
      >`
        SELECT
          id,
          status,
          started_at,
          finished_at,
          processed_count,
          success_count,
          failure_count,
          error_message
        FROM job_runs
        WHERE job_name = 'access-mode-transition'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ active_holds: number }>>`
        SELECT COUNT(*)::int AS active_holds
        FROM legal_holds
        WHERE organization_id = ${authUser.organizationId}
          AND active = true
      `,
    ]);

    const org = orgRows[0];
    return {
      accessMode: org?.access_mode || 'active',
      gracePeriodEndsAt: org?.grace_period_ends_at?.toISOString() || null,
      retentionDays: org?.retention_days || null,
      activeLegalHolds: holdRows[0]?.active_holds || 0,
      retentionCleanupLastRun: retentionRows[0]
        ? {
            id: retentionRows[0].id,
            status: retentionRows[0].status,
            startedAt: retentionRows[0].started_at.toISOString(),
            finishedAt: retentionRows[0].finished_at?.toISOString() || null,
            processedCount: retentionRows[0].processed_count,
            successCount: retentionRows[0].success_count,
            failureCount: retentionRows[0].failure_count,
            errorMessage: retentionRows[0].error_message,
          }
        : null,
      accessModeTransitionLastRun: accessRows[0]
        ? {
            id: accessRows[0].id,
            status: accessRows[0].status,
            startedAt: accessRows[0].started_at.toISOString(),
            finishedAt: accessRows[0].finished_at?.toISOString() || null,
            processedCount: accessRows[0].processed_count,
            successCount: accessRows[0].success_count,
            failureCount: accessRows[0].failure_count,
            errorMessage: accessRows[0].error_message,
          }
        : null,
    };
  }
}
