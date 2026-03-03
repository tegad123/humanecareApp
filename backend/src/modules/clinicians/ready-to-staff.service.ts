import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { ClinicianStatus } from '../../../generated/prisma/client.js';
import { randomUUID } from 'crypto';

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

  private isAttestationActive(
    attestation:
      | {
          state: 'attested' | 'revoked' | 'expired';
          expiresAt: string | null;
        }
      | null,
  ): boolean {
    if (!attestation) return false;
    return attestation.state === 'attested';
  }

  private async getDualApprovalRequired(organizationId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<
      Array<{ require_dual_approval_for_high_risk_override: boolean }>
    >`SELECT require_dual_approval_for_high_risk_override FROM organizations WHERE id = ${organizationId} LIMIT 1`;
    return rows[0]?.require_dual_approval_for_high_risk_override === true;
  }

  private async hasUnresolvedHighRiskBlockingItem(
    clinicianId: string,
    organizationId: string,
  ): Promise<boolean> {
    const count = await this.prisma.clinicianChecklistItem.count({
      where: {
        clinicianId,
        organizationId,
        itemDefinition: {
          highRisk: true,
          blocking: true,
        },
        status: {
          not: 'approved',
        },
      },
    });
    return count > 0;
  }

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
        oldValue: { status: clinician.status },
        newValue: { status: finalStatus },
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
    reasonCode: string,
    reasonText: string | null,
    expiresInHours: number,
    secondApproverUserId: string | null,
    actorUserId: string,
    actorRole: string,
  ) {
    const currentClinician = await this.prisma.clinician.findFirst({
      where: { id: clinicianId, organizationId },
      select: {
        status: true,
        adminOverrideActive: true,
        adminOverrideValue: true,
        adminOverrideReason: true,
        adminOverrideExpiresAt: true,
      },
    });

    if (!currentClinician) {
      throw new Error('Clinician not found');
    }

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
    const reason = (reasonText || '').trim() || reasonCode.replace(/_/g, ' ');

    const dualApprovalRequired = await this.getDualApprovalRequired(organizationId);
    const hasUnresolvedHighRiskBlocking = await this.hasUnresolvedHighRiskBlockingItem(
      clinicianId,
      organizationId,
    );
    const requireSecondApprover = dualApprovalRequired && hasUnresolvedHighRiskBlocking;

    if (requireSecondApprover) {
      if (!secondApproverUserId) {
        throw new Error(
          'A second approver is required for high-risk override scenarios in this organization.',
        );
      }
      if (secondApproverUserId === actorUserId) {
        throw new Error('Second approver must be a different user.');
      }
      const secondApprover = await this.prisma.user.findFirst({
        where: {
          id: secondApproverUserId,
          organizationId,
          role: { in: ['super_admin', 'admin', 'compliance'] as any },
        },
        select: { id: true },
      });
      if (!secondApprover) {
        throw new Error(
          'Second approver must be an admin/compliance user in the same organization.',
        );
      }
    }

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

    await this.prisma.$executeRaw`
      UPDATE clinicians
      SET
        admin_override_reason_code = ${reasonCode}::"OverrideReasonCode",
        admin_override_second_approver_id = ${secondApproverUserId},
        admin_override_second_approved_at = ${requireSecondApprover ? new Date() : null}
      WHERE id = ${clinicianId} AND organization_id = ${organizationId}
    `;

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
        reasonCode,
        reason,
        reasonText,
        expiresAt: expiresAt.toISOString(),
        expiresInHours: hours,
        secondApproverUserId,
        dualApprovalRequired: requireSecondApprover,
      },
      reason,
      oldValue: {
        status: currentClinician.status,
        adminOverrideActive: currentClinician.adminOverrideActive,
        adminOverrideValue: currentClinician.adminOverrideValue,
        adminOverrideReason: currentClinician.adminOverrideReason,
        adminOverrideExpiresAt: currentClinician.adminOverrideExpiresAt?.toISOString() || null,
      },
      newValue: {
        status: overrideValue,
        adminOverrideActive: true,
        adminOverrideValue: overrideValue,
        adminOverrideReason: reason,
        adminOverrideExpiresAt: expiresAt.toISOString(),
      },
    });

    return {
      overrideActive: true,
      overrideValue,
      reasonCode,
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
    const currentClinician = await this.prisma.clinician.findFirst({
      where: { id: clinicianId, organizationId },
      select: {
        status: true,
        adminOverrideActive: true,
        adminOverrideValue: true,
        adminOverrideReason: true,
        adminOverrideExpiresAt: true,
      },
    });

    await this.prisma.clinician.update({
      where: { id: clinicianId },
      data: {
        adminOverrideActive: false,
        adminOverrideValue: null,
        adminOverrideReason: null,
        adminOverrideExpiresAt: null,
      },
    });

    await this.prisma.$executeRaw`
      UPDATE clinicians
      SET
        admin_override_reason_code = NULL,
        admin_override_second_approver_id = NULL,
        admin_override_second_approved_at = NULL
      WHERE id = ${clinicianId} AND organization_id = ${organizationId}
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId,
      actorRole: actorRole as any,
      clinicianId,
      entityType: 'clinician',
      entityId: clinicianId,
      action,
      reason: action,
      oldValue: {
        status: currentClinician?.status || null,
        adminOverrideActive: currentClinician?.adminOverrideActive || false,
        adminOverrideValue: currentClinician?.adminOverrideValue || null,
        adminOverrideReason: currentClinician?.adminOverrideReason || null,
        adminOverrideExpiresAt:
          currentClinician?.adminOverrideExpiresAt?.toISOString() || null,
      },
      newValue: {
        adminOverrideActive: false,
        adminOverrideValue: null,
        adminOverrideReason: null,
        adminOverrideExpiresAt: null,
      },
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

  async getReadiness(clinicianId: string, organizationId: string) {
    const systemStatus = await this.computeStatus(clinicianId, organizationId);
    const attestation = await this.getLatestAssignmentAttestation(
      clinicianId,
      organizationId,
    );
    const assignmentEligible =
      systemStatus === 'ready' && this.isAttestationActive(attestation);
    return {
      clinicianId,
      systemStatus,
      assignmentAttestation: attestation,
      assignmentEligible,
    };
  }

  async attestAssignment(
    clinicianId: string,
    organizationId: string,
    reasonCode: string,
    reasonText: string | null,
    expiresInHours: number | null,
    actorUserId: string,
    actorRole: string,
  ) {
    const systemStatus = await this.computeStatus(clinicianId, organizationId);
    if (systemStatus !== 'ready') {
      throw new Error(
        'Cannot attest assignment unless clinician is System Ready.',
      );
    }

    const attestedAt = new Date();
    const expiresAt =
      expiresInHours && expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null;

    await this.prisma.$executeRaw`
      INSERT INTO assignment_attestations (
        id,
        organization_id,
        clinician_id,
        state,
        reason_code,
        reason_text,
        attested_by_user_id,
        attested_by_role,
        attested_at,
        expires_at,
        created_at
      ) VALUES (
        ${randomUUID()},
        ${organizationId},
        ${clinicianId},
        'attested'::"AssignmentAttestationState",
        ${reasonCode},
        ${reasonText},
        ${actorUserId},
        ${actorRole}::"Role",
        ${attestedAt},
        ${expiresAt},
        ${attestedAt}
      )
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId,
      actorRole: actorRole as any,
      clinicianId,
      entityType: 'clinician',
      entityId: clinicianId,
      action: 'assignment_attested',
      details: {
        reasonCode,
        reasonText,
        expiresAt: expiresAt?.toISOString() || null,
      },
      reason: reasonText || reasonCode,
      newValue: {
        state: 'attested',
        reasonCode,
        reasonText,
        attestedByUserId: actorUserId,
        attestedByRole: actorRole,
        expiresAt: expiresAt?.toISOString() || null,
      },
    });

    return this.getReadiness(clinicianId, organizationId);
  }

  async revokeAssignmentAttestation(
    clinicianId: string,
    organizationId: string,
    reasonCode: string,
    reasonText: string | null,
    actorUserId: string,
    actorRole: string,
  ) {
    const revokedAt = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO assignment_attestations (
        id,
        organization_id,
        clinician_id,
        state,
        reason_code,
        reason_text,
        revoked_by_user_id,
        revoked_at,
        created_at
      ) VALUES (
        ${randomUUID()},
        ${organizationId},
        ${clinicianId},
        'revoked'::"AssignmentAttestationState",
        ${reasonCode},
        ${reasonText},
        ${actorUserId},
        ${revokedAt},
        ${revokedAt}
      )
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId,
      actorRole: actorRole as any,
      clinicianId,
      entityType: 'clinician',
      entityId: clinicianId,
      action: 'assignment_attestation_revoked',
      details: {
        reasonCode,
        reasonText,
      },
      reason: reasonText || reasonCode,
      newValue: {
        state: 'revoked',
        reasonCode,
        reasonText,
        revokedByUserId: actorUserId,
        revokedAt: revokedAt.toISOString(),
      },
    });

    return this.getReadiness(clinicianId, organizationId);
  }

  async getLatestAssignmentAttestation(
    clinicianId: string,
    organizationId: string,
  ): Promise<
    | {
        state: 'attested' | 'revoked' | 'expired';
        reasonCode: string;
        reasonText: string | null;
        attestedByUserId: string | null;
        attestedByRole: string | null;
        attestedAt: string | null;
        expiresAt: string | null;
        revokedByUserId: string | null;
        revokedAt: string | null;
      }
    | null
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        state: 'attested' | 'revoked' | 'expired';
        reason_code: string;
        reason_text: string | null;
        attested_by_user_id: string | null;
        attested_by_role: string | null;
        attested_at: Date | null;
        expires_at: Date | null;
        revoked_by_user_id: string | null;
        revoked_at: Date | null;
      }>
    >`
      SELECT
        state,
        reason_code,
        reason_text,
        attested_by_user_id,
        attested_by_role,
        attested_at,
        expires_at,
        revoked_by_user_id,
        revoked_at
      FROM assignment_attestations
      WHERE clinician_id = ${clinicianId}
        AND organization_id = ${organizationId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const latest = rows[0];
    if (!latest) return null;

    let state = latest.state;
    if (
      latest.state === 'attested' &&
      latest.expires_at &&
      latest.expires_at <= new Date()
    ) {
      state = 'expired';
    }

    return {
      state,
      reasonCode: latest.reason_code,
      reasonText: latest.reason_text,
      attestedByUserId: latest.attested_by_user_id,
      attestedByRole: latest.attested_by_role,
      attestedAt: latest.attested_at?.toISOString() || null,
      expiresAt: latest.expires_at?.toISOString() || null,
      revokedByUserId: latest.revoked_by_user_id,
      revokedAt: latest.revoked_at?.toISOString() || null,
    };
  }
}
