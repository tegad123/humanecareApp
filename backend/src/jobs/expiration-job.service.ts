import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReadyToStaffService } from '../modules/clinicians/ready-to-staff.service.js';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service.js';
import { ChecklistItemStatus } from '../../generated/prisma/client.js';

/**
 * Daily cron job that runs at 2:00 AM to:
 * 1. Find approved checklist items with expiresAt <= now
 * 2. Flip their status to "expired"
 * 3. Recompute each affected clinician's Ready-to-Staff status
 * 4. Clear any expired admin overrides
 */
@Injectable()
export class ExpirationJobService {
  private readonly logger = new Logger(ExpirationJobService.name);

  constructor(
    private prisma: PrismaService,
    private readyToStaff: ReadyToStaffService,
    private auditLogs: AuditLogsService,
  ) {}

  /**
   * Run daily at 2:00 AM server time.
   */
  @Cron('0 2 * * *', { name: 'checklist-item-expiration' })
  async handleItemExpiration() {
    this.logger.log('Starting daily expiration check...');

    try {
      // Find all approved items where expiresAt has passed
      const expiredItems = await this.prisma.clinicianChecklistItem.findMany({
        where: {
          status: 'approved' as ChecklistItemStatus,
          expiresAt: { lte: new Date() },
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
            },
          },
        },
      });

      if (expiredItems.length === 0) {
        this.logger.log('No expired items found.');
        return;
      }

      this.logger.log(`Found ${expiredItems.length} expired item(s). Processing...`);

      // Track unique clinicians that need status recomputation
      const affectedClinicians = new Set<string>();

      for (const item of expiredItems) {
        // Flip status to expired
        await this.prisma.clinicianChecklistItem.update({
          where: { id: item.id },
          data: { status: 'expired' as ChecklistItemStatus },
        });

        // Log the expiration
        await this.auditLogs.log({
          organizationId: item.clinician.organizationId,
          entityType: 'checklist_item',
          entityId: item.id,
          clinicianId: item.clinician.id,
          action: 'item_expired',
          details: {
            label: item.itemDefinition.label,
            blocking: item.itemDefinition.blocking,
            expiresAt: item.expiresAt?.toISOString(),
            clinicianName: `${item.clinician.firstName} ${item.clinician.lastName}`,
          },
        });

        this.logger.log(
          `Expired: ${item.itemDefinition.label} for ${item.clinician.firstName} ${item.clinician.lastName}`,
        );

        affectedClinicians.add(
          `${item.clinician.id}::${item.clinician.organizationId}`,
        );
      }

      // Recompute status for all affected clinicians
      for (const key of affectedClinicians) {
        const [clinicianId, organizationId] = key.split('::');
        await this.readyToStaff.computeStatus(clinicianId, organizationId);
      }

      this.logger.log(
        `Expiration check complete. ${expiredItems.length} item(s) expired, ${affectedClinicians.size} clinician(s) recomputed.`,
      );
    } catch (error: any) {
      this.logger.error(`Expiration job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Also clear expired admin overrides daily.
   */
  @Cron('0 2 * * *', { name: 'override-expiration' })
  async handleOverrideExpiration() {
    this.logger.log('Checking for expired admin overrides...');

    try {
      const expiredOverrides = await this.prisma.clinician.findMany({
        where: {
          adminOverrideActive: true,
          adminOverrideExpiresAt: { lte: new Date() },
        },
        select: { id: true, organizationId: true, firstName: true, lastName: true },
      });

      if (expiredOverrides.length === 0) {
        this.logger.log('No expired overrides found.');
        return;
      }

      this.logger.log(
        `Found ${expiredOverrides.length} expired override(s). Clearing...`,
      );

      for (const clinician of expiredOverrides) {
        await this.prisma.clinician.update({
          where: { id: clinician.id },
          data: {
            adminOverrideActive: false,
            adminOverrideValue: null,
            adminOverrideReason: null,
            adminOverrideExpiresAt: null,
          },
        });

        await this.auditLogs.log({
          organizationId: clinician.organizationId,
          clinicianId: clinician.id,
          entityType: 'clinician',
          entityId: clinician.id,
          action: 'override_expired',
          details: {
            clinicianName: `${clinician.firstName} ${clinician.lastName}`,
          },
        });

        // Recompute status
        await this.readyToStaff.computeStatus(
          clinician.id,
          clinician.organizationId,
        );

        this.logger.log(
          `Cleared expired override for ${clinician.firstName} ${clinician.lastName}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Override expiration job failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
