import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service.js';
import { JobRunsService } from './job-runs.service.js';

@Injectable()
export class DataRetentionJobService {
  private readonly logger = new Logger(DataRetentionJobService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private auditLogs: AuditLogsService,
    private jobRuns: JobRunsService,
  ) {}

  /**
   * Transition organizations from read_only to suspended when grace period has elapsed.
   */
  @Cron('0 * * * *', { name: 'access-mode-transition' })
  async handleAccessModeTransition() {
    let runId: string | null = null;
    const counts = { processedCount: 0, successCount: 0, failureCount: 0 };

    try {
      runId = await this.jobRuns.startRun('access-mode-transition');
    } catch (error) {
      this.jobRuns.logFallback('access-mode-transition', error);
    }

    try {
      const transitioned = await this.prisma.$queryRaw<
        Array<{ id: string; grace_period_ends_at: Date | null }>
      >`
        UPDATE organizations
        SET
          access_mode = 'suspended'::"OrgAccessMode",
          updated_at = NOW()
        WHERE access_mode = 'read_only'::"OrgAccessMode"
          AND grace_period_ends_at IS NOT NULL
          AND grace_period_ends_at < NOW()
        RETURNING id, grace_period_ends_at
      `;

      counts.processedCount = transitioned.length;

      for (const org of transitioned) {
        await this.auditLogs.log({
          organizationId: org.id,
          entityType: 'organization',
          entityId: org.id,
          action: 'access_mode_auto_suspended',
          details: {
            from: 'read_only',
            to: 'suspended',
            gracePeriodEndsAt: org.grace_period_ends_at?.toISOString() || null,
          },
          oldValue: {
            accessMode: 'read_only',
          },
          newValue: {
            accessMode: 'suspended',
          },
        });
        counts.successCount++;
      }

      if (runId) {
        await this.jobRuns.completeRun(runId, counts);
      }
    } catch (error: any) {
      counts.failureCount++;
      this.logger.error(
        `Access mode transition job failed: ${error.message}`,
        error.stack,
      );
      if (runId) {
        await this.jobRuns.failRun(
          runId,
          error.message || 'Access mode transition failed',
          counts,
        );
      }
    }
  }

  /**
   * Daily retention cleanup:
   * - Honors legal hold by skipping organizations with any active hold.
   * - Deletes old export artifacts and export job rows beyond org retention window.
   * - Prunes old job run rows beyond org retention window.
   */
  @Cron('30 3 * * *', { name: 'data-retention-cleanup' })
  async handleRetentionCleanup() {
    let runId: string | null = null;
    const counts = { processedCount: 0, successCount: 0, failureCount: 0 };
    let skippedLegalHold = 0;
    let exportRowsDeleted = 0;
    let exportFilesDeleted = 0;
    let jobRunsDeleted = 0;

    try {
      runId = await this.jobRuns.startRun('data-retention-cleanup');
    } catch (error) {
      this.jobRuns.logFallback('data-retention-cleanup', error);
    }

    try {
      const organizations = await this.prisma.$queryRaw<
        Array<{
          id: string;
          retention_days: number;
          has_active_hold: boolean;
        }>
      >`
        SELECT
          o.id,
          o.retention_days,
          EXISTS (
            SELECT 1
            FROM legal_holds lh
            WHERE lh.organization_id = o.id
              AND lh.active = true
          ) AS has_active_hold
        FROM organizations o
      `;

      for (const org of organizations) {
        counts.processedCount++;

        if (org.has_active_hold) {
          skippedLegalHold++;
          continue;
        }

        const retentionDays = Math.max(30, org.retention_days || 2555);
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        // Remove aged export artifacts first, then delete rows.
        const oldExports = await this.prisma.$queryRaw<
          Array<{ id: string; file_storage_path: string | null }>
        >`
          SELECT id, file_storage_path
          FROM organization_export_jobs
          WHERE organization_id = ${org.id}
            AND requested_at < ${cutoff}
        `;

        for (const exportJob of oldExports) {
          if (!exportJob.file_storage_path) continue;
          try {
            await this.storage.deleteFile(exportJob.file_storage_path);
            exportFilesDeleted++;
          } catch (error: any) {
            this.logger.warn(
              `Failed to delete export artifact ${exportJob.file_storage_path}: ${error.message}`,
            );
          }
        }

        const deletedExportRows = await this.prisma.$executeRaw`
          DELETE FROM organization_export_jobs
          WHERE organization_id = ${org.id}
            AND requested_at < ${cutoff}
        `;
        exportRowsDeleted += deletedExportRows;

        const deletedJobRunRows = await this.prisma.$executeRaw`
          DELETE FROM job_runs
          WHERE organization_id = ${org.id}
            AND created_at < ${cutoff}
            AND job_name <> 'data-retention-cleanup'
        `;
        jobRunsDeleted += deletedJobRunRows;

        await this.auditLogs.log({
          organizationId: org.id,
          entityType: 'organization',
          entityId: org.id,
          action: 'retention_cleanup_executed',
          details: {
            retentionDays,
            cutoff: cutoff.toISOString(),
            exportRowsDeleted: deletedExportRows,
            jobRunsDeleted: deletedJobRunRows,
          },
        });

        counts.successCount++;
      }

      if (runId) {
        await this.jobRuns.completeRun(runId, counts, {
          skippedLegalHold,
          exportRowsDeleted,
          exportFilesDeleted,
          jobRunsDeleted,
        });
      }
    } catch (error: any) {
      counts.failureCount++;
      this.logger.error(
        `Retention cleanup job failed: ${error.message}`,
        error.stack,
      );
      if (runId) {
        await this.jobRuns.failRun(
          runId,
          error.message || 'Retention cleanup failed',
          counts,
          {
            skippedLegalHold,
            exportRowsDeleted,
            exportFilesDeleted,
            jobRunsDeleted,
          },
        );
      }
    }
  }
}
