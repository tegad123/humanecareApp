import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { ClinicianStatus } from '../../../generated/prisma/client.js';

/**
 * Computes and updates the Ready-to-Staff status for a clinician.
 *
 * Rules:
 * 1. "ready" = ALL blocking items are "approved" AND not expired
 * 2. "not_ready" = any blocking item is NOT "approved" or is expired
 * 3. "onboarding" = clinician is new, at least one item is not_started
 * 4. Override: Admin can force status for up to 72h (except when state license is expired)
 * 5. Override is NEVER allowed if there is an expired state license item
 */
@Injectable()
export class ReadyToStaffService {
  private readonly logger = new Logger(ReadyToStaffService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  /**
   * Recompute the clinician's status based on checklist item states.
   * Called after every item review, submission (auto-approve), and by cron jobs.
   */
  async computeStatus(clinicianId: string, organizationId: string) {
    const clinician = await this.prisma.clinician.findFirst({
      where: { id: clinicianId, organizationId },
    });

    if (!clinician) return;

    // Get all checklist items with their definitions
    const items = await this.prisma.clinicianChecklistItem.findMany({
      where: { clinicianId, organizationId },
      include: {
        itemDefinition: {
          select: {
            required: true,
            blocking: true,
            label: true,
            section: true,
          },
        },
      },
    });

    if (items.length === 0) return;

    const blockingItems = items.filter((i) => i.itemDefinition.blocking);
    const allItems = items;

    // Check if all blocking items are approved and not expired
    const allBlockingApproved = blockingItems.every(
      (i) => i.status === 'approved',
    );
    const anyBlockingExpired = blockingItems.some(
      (i) => i.status === 'expired',
    );
    const anyNotStarted = allItems.some(
      (i) => i.status === 'not_started',
    );

    // Determine computed status
    let computedStatus: ClinicianStatus;

    if (allBlockingApproved && !anyBlockingExpired && blockingItems.length > 0) {
      computedStatus = 'ready' as ClinicianStatus;
    } else if (anyNotStarted && !anyBlockingExpired) {
      computedStatus = 'onboarding' as ClinicianStatus;
    } else {
      computedStatus = 'not_ready' as ClinicianStatus;
    }

    // Check if override is active
    let finalStatus = computedStatus;

    if (clinician.adminOverrideActive) {
      // Check if override has expired
      if (
        clinician.adminOverrideExpiresAt &&
        clinician.adminOverrideExpiresAt <= new Date()
      ) {
        // Override expired — clear it
        await this.clearOverrideInternal(clinicianId, organizationId, 'override_expired');
      } else {
        // Check for expired state license — override is NEVER allowed in this case
        const hasExpiredLicense = await this.hasExpiredStateLicense(
          clinicianId,
          organizationId,
        );

        if (hasExpiredLicense) {
          // Auto-clear override
          await this.clearOverrideInternal(
            clinicianId,
            organizationId,
            'expired_license_detected',
          );
        } else if (clinician.adminOverrideValue) {
          // Override is valid — use it
          finalStatus = clinician.adminOverrideValue;
        }
      }
    }

    // Only update if status has changed
    if (clinician.status !== finalStatus) {
      await this.prisma.clinician.update({
        where: { id: clinicianId },
        data: { status: finalStatus },
      });

      this.logger.log(
        `Clinician ${clinicianId} status: ${clinician.status} → ${finalStatus}`,
      );

      await this.auditLogs.log({
        organizationId,
        clinicianId,
        entityType: 'clinician',
        entityId: clinicianId,
        action: 'status_recomputed',
        details: {
          previousStatus: clinician.status,
          newStatus: finalStatus,
          computedStatus,
          overrideActive: clinician.adminOverrideActive,
        },
      });
    }

    return finalStatus;
  }

  /**
   * Set an admin override on a clinician's status.
   * Max duration: 72 hours.
   * Blocked if there's an expired state license.
   */
  async setOverride(
    clinicianId: string,
    organizationId: string,
    overrideValue: ClinicianStatus,
    reason: string,
    expiresInHours: number,
    actorUserId: string,
    actorRole: string,
  ) {
    // Check for expired state license
    const hasExpiredLicense = await this.hasExpiredStateLicense(
      clinicianId,
      organizationId,
    );

    if (hasExpiredLicense) {
      throw new Error(
        'Cannot set override: clinician has an expired state license. This must be resolved first.',
      );
    }

    // Cap at 72 hours
    const maxHours = 72;
    const hours = Math.min(expiresInHours, maxHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await this.prisma.clinician.update({
      where: { id: clinicianId },
      data: {
        adminOverrideActive: true,
        adminOverrideValue: overrideValue,
        adminOverrideReason: reason,
        adminOverrideExpiresAt: expiresAt,
        status: overrideValue,
      },
    });

    await this.auditLogs.log({
      organizationId,
      actorUserId,
      actorRole: actorRole as any,
      clinicianId,
      entityType: 'clinician',
      entityId: clinicianId,
      action: 'override_set',
      details: {
        overrideValue,
        reason,
        expiresAt: expiresAt.toISOString(),
        expiresInHours: hours,
      },
    });

    return {
      overrideActive: true,
      overrideValue,
      reason,
      expiresAt,
    };
  }

  /**
   * Clear an admin override.
   */
  async clearOverride(
    clinicianId: string,
    organizationId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    await this.clearOverrideInternal(
      clinicianId,
      organizationId,
      'override_cleared_by_admin',
      actorUserId,
      actorRole,
    );

    // Recompute status after clearing override
    return this.computeStatus(clinicianId, organizationId);
  }

  /**
   * Internal helper to clear override fields.
   */
  private async clearOverrideInternal(
    clinicianId: string,
    organizationId: string,
    action: string,
    actorUserId?: string,
    actorRole?: string,
  ) {
    await this.prisma.clinician.update({
      where: { id: clinicianId },
      data: {
        adminOverrideActive: false,
        adminOverrideValue: null,
        adminOverrideReason: null,
        adminOverrideExpiresAt: null,
      },
    });

    await this.auditLogs.log({
      organizationId,
      actorUserId,
      actorRole: actorRole as any,
      clinicianId,
      entityType: 'clinician',
      entityId: clinicianId,
      action,
    });
  }

  /**
   * Check if a clinician has any expired item with "license" in the label
   * (specifically state license items).
   */
  private async hasExpiredStateLicense(
    clinicianId: string,
    organizationId: string,
  ): Promise<boolean> {
    const expiredLicenseItems = await this.prisma.clinicianChecklistItem.findMany({
      where: {
        clinicianId,
        organizationId,
        status: 'expired',
        itemDefinition: {
          label: { contains: 'License', mode: 'insensitive' },
          blocking: true,
        },
      },
    });

    return expiredLicenseItems.length > 0;
  }
}
