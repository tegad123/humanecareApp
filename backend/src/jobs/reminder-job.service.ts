import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from './email.service.js';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service.js';
import { ChecklistItemStatus } from '../../generated/prisma/client.js';
import { JobRunsService } from './job-runs.service.js';

/**
 * Daily cron job that runs at 8:00 AM to send expiration reminders.
 *
 * Sends reminders at these thresholds:
 * - 30 days before expiration
 * - 14 days before expiration
 * - 7 days before expiration
 * - 1 day before expiration
 * - On the day of expiration (0 days)
 */
@Injectable()
export class ReminderJobService {
  private readonly logger = new Logger(ReminderJobService.name);

  /** Days before expiration at which reminders are sent */
  private readonly REMINDER_DAYS = [30, 14, 7, 1, 0];

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private auditLogs: AuditLogsService,
    private jobRuns: JobRunsService,
  ) {}

  /**
   * Run daily at 8:00 AM server time.
   */
  @Cron('0 8 * * *', { name: 'expiration-reminders' })
  async handleReminders() {
    this.logger.log('Starting daily reminder check...');

    let runId: string | null = null;
    const totals = {
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
    };
    const byDay: Record<number, { processed: number; success: number; failure: number }> = {};

    try {
      runId = await this.jobRuns.startRun('expiration-reminders');
    } catch (error) {
      this.jobRuns.logFallback('expiration-reminders', error);
    }

    try {
      for (const daysAhead of this.REMINDER_DAYS) {
        const counts = await this.processRemindersForDay(daysAhead);
        byDay[daysAhead] = {
          processed: counts.processedCount,
          success: counts.successCount,
          failure: counts.failureCount,
        };
        totals.processedCount += counts.processedCount;
        totals.successCount += counts.successCount;
        totals.failureCount += counts.failureCount;
      }

      this.logger.log(
        `Reminder check complete. ${totals.successCount} reminder(s) sent, ${totals.failureCount} failure(s).`,
      );

      if (runId) {
        await this.jobRuns.completeRun(runId, totals, { byDay });
      }
    } catch (error: any) {
      this.logger.error(`Reminder job failed: ${error.message}`, error.stack);
      if (runId) {
        await this.jobRuns.failRun(runId, error.message || 'Reminder job failed', totals, {
          byDay,
        });
      }
    }
  }

  /**
   * Find items expiring exactly `daysAhead` days from now and send reminders.
   */
  private async processRemindersForDay(daysAhead: number): Promise<{
    processedCount: number;
    successCount: number;
    failureCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysAhead);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find approved items with expiration falling on this target date
    const expiringItems = await this.prisma.clinicianChecklistItem.findMany({
      where: {
        status: 'approved' as ChecklistItemStatus,
        expiresAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      include: {
        itemDefinition: {
          select: { label: true, blocking: true },
        },
        clinician: {
          select: {
            id: true,
            organizationId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (expiringItems.length === 0) {
      return { processedCount: 0, successCount: 0, failureCount: 0 };
    }

    this.logger.log(
      `Found ${expiringItems.length} item(s) expiring in ${daysAhead} day(s).`,
    );

    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const item of expiringItems) {
      processedCount++;
      const clinicianName = `${item.clinician.firstName} ${item.clinician.lastName}`;

      try {
        // Send reminder to clinician
        await this.emailService.sendExpirationReminder(
          item.clinician.email,
          clinicianName,
          item.itemDefinition.label,
          daysAhead,
          item.expiresAt!,
        );

        // Also notify org admins for items expiring within 7 days
        let adminNotificationFailures = 0;
        if (daysAhead <= 7) {
          adminNotificationFailures = await this.notifyOrgAdmins(
            item.clinician.organizationId,
            clinicianName,
            item.itemDefinition.label,
            daysAhead,
          );
        }

        // Log the reminder
        await this.auditLogs.log({
          organizationId: item.clinician.organizationId,
          clinicianId: item.clinician.id,
          entityType: 'checklist_item',
          entityId: item.id,
          action: 'expiration_reminder_sent',
          details: {
            label: item.itemDefinition.label,
            daysUntilExpiry: daysAhead,
            expiresAt: item.expiresAt?.toISOString(),
            adminNotificationFailures,
          },
        });

        successCount++;
        failureCount += adminNotificationFailures;
      } catch (error: any) {
        failureCount++;
        this.logger.warn(
          `Failed reminder for item ${item.id} (${daysAhead} day(s) ahead): ${error.message}`,
        );
      }
    }

    return { processedCount, successCount, failureCount };
  }

  /**
   * Send notification emails to all admins in the organization.
   */
  private async notifyOrgAdmins(
    organizationId: string,
    clinicianName: string,
    itemLabel: string,
    daysUntilExpiry: number,
  ): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['admin', 'super_admin'] as any },
      },
      select: { email: true },
    });

    let failures = 0;
    for (const admin of admins) {
      try {
        await this.emailService.sendAdminExpirationAlert(
          admin.email,
          clinicianName,
          itemLabel,
          daysUntilExpiry,
        );
      } catch {
        failures++;
      }
    }
    return failures;
  }
}
