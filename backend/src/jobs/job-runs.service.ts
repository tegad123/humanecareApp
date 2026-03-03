import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

type JobRunStatus = 'running' | 'success' | 'failed';

@Injectable()
export class JobRunsService {
  private readonly logger = new Logger(JobRunsService.name);

  constructor(private prisma: PrismaService) {}

  async startRun(
    jobName: string,
    options?: {
      organizationId?: string | null;
      metadata?: Record<string, any> | null;
    },
  ): Promise<string> {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO job_runs (
        id,
        organization_id,
        job_name,
        status,
        started_at,
        metadata_json
      ) VALUES (
        ${id},
        ${options?.organizationId || null},
        ${jobName},
        'running'::"JobRunStatus",
        NOW(),
        ${options?.metadata ? JSON.stringify(options.metadata) : null}::jsonb
      )
    `;
    return id;
  }

  async completeRun(
    runId: string,
    counts: { processedCount?: number; successCount?: number; failureCount?: number },
    metadata?: Record<string, any> | null,
  ) {
    await this.finishRun(runId, 'success', null, counts, metadata);
  }

  async failRun(
    runId: string,
    errorMessage: string,
    counts?: { processedCount?: number; successCount?: number; failureCount?: number },
    metadata?: Record<string, any> | null,
  ) {
    await this.finishRun(runId, 'failed', errorMessage, counts || {}, metadata);
  }

  private async finishRun(
    runId: string,
    status: JobRunStatus,
    errorMessage: string | null,
    counts: { processedCount?: number; successCount?: number; failureCount?: number },
    metadata?: Record<string, any> | null,
  ) {
    await this.prisma.$executeRaw`
      UPDATE job_runs
      SET
        status = ${status}::"JobRunStatus",
        finished_at = NOW(),
        processed_count = ${counts.processedCount ?? 0},
        success_count = ${counts.successCount ?? 0},
        failure_count = ${counts.failureCount ?? 0},
        error_message = ${errorMessage},
        metadata_json = ${metadata ? JSON.stringify(metadata) : null}::jsonb
      WHERE id = ${runId}
    `;
  }

  async getReminderHealth(
    organizationId: string,
    organizationTimezone: string | null,
  ): Promise<{
    timezone: string | null;
    timezoneConfigured: boolean;
    lastRun: null | {
      id: string;
      status: JobRunStatus;
      startedAt: string;
      finishedAt: string | null;
      processedCount: number;
      successCount: number;
      failureCount: number;
      errorMessage: string | null;
    };
    recent7d: {
      totalRuns: number;
      failedRuns: number;
      lastFailureAt: string | null;
      emailFailureCount: number;
      bounceCount: number;
      complaintCount: number;
    };
  }> {
    type LastRunRow = {
      id: string;
      status: JobRunStatus;
      started_at: Date;
      finished_at: Date | null;
      processed_count: number;
      success_count: number;
      failure_count: number;
      error_message: string | null;
    };
    const lastRows = await this.prisma.$queryRaw<LastRunRow[]>`
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
      WHERE job_name = 'expiration-reminders'
        AND (organization_id = ${organizationId} OR organization_id IS NULL)
      ORDER BY created_at DESC
      LIMIT 1
    `;

    type AggregateRow = {
      total_runs: number;
      failed_runs: number;
      email_failure_count: number;
      last_failure_at: Date | null;
    };
    const aggregateRows = await this.prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COUNT(*)::int AS total_runs,
        SUM(CASE WHEN status = 'failed'::"JobRunStatus" THEN 1 ELSE 0 END)::int AS failed_runs,
        COALESCE(SUM(failure_count), 0)::int AS email_failure_count,
        MAX(CASE WHEN status = 'failed'::"JobRunStatus" THEN finished_at ELSE NULL END) AS last_failure_at
      FROM job_runs
      WHERE job_name = 'expiration-reminders'
        AND created_at >= NOW() - INTERVAL '7 days'
        AND (organization_id = ${organizationId} OR organization_id IS NULL)
    `;

    const last = lastRows[0] || null;
    const aggregate = aggregateRows[0] || {
      total_runs: 0,
      failed_runs: 0,
      email_failure_count: 0,
      last_failure_at: null,
    };

    return {
      timezone: organizationTimezone,
      timezoneConfigured: Boolean(organizationTimezone),
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            startedAt: last.started_at.toISOString(),
            finishedAt: last.finished_at ? last.finished_at.toISOString() : null,
            processedCount: last.processed_count,
            successCount: last.success_count,
            failureCount: last.failure_count,
            errorMessage: last.error_message,
          }
        : null,
      recent7d: {
        totalRuns: aggregate.total_runs || 0,
        failedRuns: aggregate.failed_runs || 0,
        emailFailureCount: aggregate.email_failure_count || 0,
        lastFailureAt: aggregate.last_failure_at
          ? aggregate.last_failure_at.toISOString()
          : null,
        // Placeholders until provider webhook metrics are integrated.
        bounceCount: 0,
        complaintCount: 0,
      },
    };
  }

  logFallback(jobName: string, error: unknown) {
    this.logger.warn(`Job run tracking failed for ${jobName}`);
    this.logger.debug(error);
  }
}

