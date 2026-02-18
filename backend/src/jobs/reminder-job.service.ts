import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from './email.service.js';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service.js';
import { ChecklistItemStatus } from '../../generated/prisma/client.js';

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
  ) {}

  /**
   * Run daily at 8:00 AM server time.
   */
  @Cron('0 8 * * *', { name: 'expiration-reminders' })
  async handleReminders() {
    this.logger.log('Starting daily reminder check...');

    try {
      let totalReminders = 0;

      for (const daysAhead of this.REMINDER_DAYS) {
        const count = await this.processRemindersForDay(daysAhead);
        totalReminders += count;
      }

      this.logger.log(
        `Reminder check complete. ${totalReminders} reminder(s) sent.`,
      );
    } catch (error: any) {
      this.logger.error(`Reminder job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Find items expiring exactly `daysAhead` days from now and send reminders.
   */
  private async processRemindersForDay(daysAhead: number): Promise<number> {
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

    if (expiringItems.length === 0) return 0;

    this.logger.log(
      `Found ${expiringItems.length} item(s) expiring in ${daysAhead} day(s).`,
    );

    let sentCount = 0;

    for (const item of expiringItems) {
      const clinicianName = `${item.clinician.firstName} ${item.clinician.lastName}`;

      // Send reminder to clinician
      await this.emailService.sendExpirationReminder(
        item.clinician.email,
        clinicianName,
        item.itemDefinition.label,
        daysAhead,
        item.expiresAt!,
      );

      // Also notify org admins for items expiring within 7 days
      if (daysAhead <= 7) {
        await this.notifyOrgAdmins(
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
        },
      });

      sentCount++;
    }

    return sentCount;
  }

  /**
   * Send notification emails to all admins in the organization.
   */
  private async notifyOrgAdmins(
    organizationId: string,
    clinicianName: string,
    itemLabel: string,
    daysUntilExpiry: number,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['admin', 'super_admin'] as any },
      },
      select: { email: true },
    });

    for (const admin of admins) {
      await this.emailService.sendAdminExpirationAlert(
        admin.email,
        clinicianName,
        itemLabel,
        daysUntilExpiry,
      );
    }
  }
}
