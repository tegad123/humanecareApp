import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { CreateLegalHoldDto } from './dto/create-legal-hold.dto.js';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto.js';
import { UpdateCorrectiveActionDto } from './dto/update-corrective-action.dto.js';
import { AcceptPolicyDto } from './dto/accept-policy.dto.js';

@Injectable()
export class ExportsService {
  private readonly policyVersions = {
    terms: '2026-03-01',
    privacy: '2026-03-01',
    baa: '2026-03-01',
  } as const;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private auditLogs: AuditLogsService,
  ) {}

  async hasActiveLegalHold(organizationId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ cnt: number }>>`
      SELECT COUNT(*)::int AS cnt
      FROM legal_holds
      WHERE organization_id = ${organizationId}
        AND active = true
    `;
    return (rows[0]?.cnt || 0) > 0;
  }

  async createOrgExport(organizationId: string, user: AuthenticatedUser) {
    const jobId = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO organization_export_jobs (
        id,
        organization_id,
        requested_by_user_id,
        status,
        format,
        requested_at
      ) VALUES (
        ${jobId},
        ${organizationId},
        ${user.id},
        'processing'::"ExportJobStatus",
        'json',
        NOW()
      )
    `;

    try {
      const orgRows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          timezone: string | null;
          access_mode: string;
          grace_period_ends_at: Date | null;
          retention_days: number;
          plan_tier: string;
        }>
      >`
        SELECT
          id,
          name,
          timezone,
          access_mode,
          grace_period_ends_at,
          retention_days,
          plan_tier
        FROM organizations
        WHERE id = ${organizationId}
        LIMIT 1
      `;
      const organization = orgRows[0];
      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const [
        clinicians,
        checklistItems,
        templateDocs,
        auditRows,
        signatureRows,
        assignmentAttestationRows,
        templatePublishRows,
      ] =
        await Promise.all([
          this.prisma.clinician.findMany({
            where: { organizationId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              discipline: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: 'asc' },
          }),
          this.prisma.clinicianChecklistItem.findMany({
            where: { organizationId },
            select: {
              id: true,
              clinicianId: true,
              itemDefinitionId: true,
              status: true,
              expiresAt: true,
              reviewedAt: true,
              rejectionReason: true,
              docStoragePath: true,
              docOriginalName: true,
              docMimeType: true,
              docType: true,
              extractedExpirationDate: true,
              signerName: true,
              signatureTimestamp: true,
              signatureHash: true,
              signatureCertificatePath: true,
              updatedAt: true,
            },
          }),
          this.prisma.templateDocument.findMany({
            where: { organizationId },
            select: {
              id: true,
              templateId: true,
              name: true,
              category: true,
              storagePath: true,
              mimeType: true,
              fileSizeBytes: true,
              createdAt: true,
            },
          }),
          this.prisma.$queryRaw<
            Array<{
              id: string;
              action: string;
              entity_type: string;
              entity_id: string;
              actor_user_id: string | null;
              actor_role: string | null;
              request_id: string;
              created_at: Date;
            }>
          >`
            SELECT
              id,
              action,
              entity_type,
              entity_id,
              actor_user_id,
              actor_role,
              request_id,
              created_at
            FROM audit_events
            WHERE organization_id = ${organizationId}
            ORDER BY created_at ASC
          `,
          this.prisma.$queryRaw<
            Array<{
              id: string;
              clinician_id: string;
              checklist_item_id: string;
              signer_name: string;
              signed_at: Date;
              linked_document_hash: string;
              linked_document_version: number | null;
              certificate_storage_path: string;
              created_at: Date;
            }>
          >`
            SELECT
              id,
              clinician_id,
              checklist_item_id,
              signer_name,
              signed_at,
              linked_document_hash,
              linked_document_version,
              certificate_storage_path,
              created_at
            FROM signature_certificates
            WHERE organization_id = ${organizationId}
            ORDER BY created_at ASC
          `,
          this.prisma.$queryRaw<
            Array<{
              id: string;
              clinician_id: string;
              state: string;
              reason_code: string;
              reason_text: string | null;
              attested_by_user_id: string | null;
              attested_by_role: string | null;
              attested_at: Date;
              expires_at: Date | null;
              revoked_by_user_id: string | null;
              revoked_at: Date | null;
              created_at: Date;
            }>
          >`
            SELECT
              id,
              clinician_id,
              state,
              reason_code,
              reason_text,
              attested_by_user_id,
              attested_by_role,
              attested_at,
              expires_at,
              revoked_by_user_id,
              revoked_at,
              created_at
            FROM assignment_attestations
            WHERE organization_id = ${organizationId}
            ORDER BY created_at ASC
          `,
          this.prisma.$queryRaw<
            Array<{
              id: string;
              template_id: string;
              published_by_user_id: string;
              published_by_role: string;
              published_revision: number;
              jurisdiction_state: string | null;
              discipline: string | null;
              required_categories_json: any;
              attestation_accepted: boolean;
              attestation_text: string | null;
              published_at: Date;
            }>
          >`
            SELECT
              id,
              template_id,
              published_by_user_id,
              published_by_role,
              published_revision,
              jurisdiction_state,
              discipline,
              required_categories_json,
              attestation_accepted,
              attestation_text,
              published_at
            FROM template_publish_attestations
            WHERE organization_id = ${organizationId}
            ORDER BY published_at ASC
          `,
        ]);

      const generatedAt = new Date().toISOString();
      const payload = {
        generatedAt,
        generatedByUserId: user.id,
        organization: {
          id: organization.id,
          name: organization.name,
          timezone: organization.timezone,
          accessMode: organization.access_mode,
          gracePeriodEndsAt: organization.grace_period_ends_at?.toISOString() || null,
          retentionDays: organization.retention_days,
          planTier: organization.plan_tier,
        },
        counts: {
          clinicians: clinicians.length,
          checklistItems: checklistItems.length,
          documents: templateDocs.length,
          signatureCertificates: signatureRows.length,
          assignmentAttestations: assignmentAttestationRows.length,
          templatePublishAttestations: templatePublishRows.length,
          auditEvents: auditRows.length,
        },
        clinicians,
        checklistItems,
        documents: templateDocs,
        signatureCertificates: signatureRows.map((row) => ({
          ...row,
          signed_at: row.signed_at.toISOString(),
          created_at: row.created_at.toISOString(),
        })),
        assignmentAttestations: assignmentAttestationRows.map((row) => ({
          ...row,
          attested_at: row.attested_at.toISOString(),
          expires_at: row.expires_at?.toISOString() || null,
          revoked_at: row.revoked_at?.toISOString() || null,
          created_at: row.created_at.toISOString(),
        })),
        templatePublishAttestations: templatePublishRows.map((row) => ({
          ...row,
          published_at: row.published_at.toISOString(),
        })),
        auditEvents: auditRows.map((row) => ({
          ...row,
          created_at: row.created_at.toISOString(),
        })),
      };

      const fileStoragePath = `${organizationId}/exports/org-export-${jobId}.json`;
      const { url } = await this.storage.getUploadUrlForKey(
        fileStoragePath,
        'application/json',
      );
      const upload = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2),
      });
      if (!upload.ok) {
        throw new BadRequestException('Failed to upload export artifact');
      }

      await this.prisma.$executeRaw`
        UPDATE organization_export_jobs
        SET
          status = 'completed'::"ExportJobStatus",
          file_storage_path = ${fileStoragePath},
          completed_at = NOW(),
          metadata_json = ${JSON.stringify(payload.counts)}::jsonb
        WHERE id = ${jobId}
      `;

      await this.auditLogs.log({
        organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        entityType: 'organization_export_job',
        entityId: jobId,
        action: 'organization_export_completed',
        details: payload.counts,
      });

      return this.getExportJob(organizationId, jobId);
    } catch (error: any) {
      await this.prisma.$executeRaw`
        UPDATE organization_export_jobs
        SET
          status = 'failed'::"ExportJobStatus",
          error_message = ${error?.message || 'Export failed'},
          completed_at = NOW()
        WHERE id = ${jobId}
      `;
      await this.auditLogs.log({
        organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        entityType: 'organization_export_job',
        entityId: jobId,
        action: 'organization_export_failed',
        details: {
          error: error?.message || 'Export failed',
        },
      });
      throw error;
    }
  }

  async listExportJobs(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        format: string;
        requested_at: Date;
        completed_at: Date | null;
        error_message: string | null;
      }>
    >`
      SELECT
        id,
        status,
        format,
        requested_at,
        completed_at,
        error_message
      FROM organization_export_jobs
      WHERE organization_id = ${organizationId}
      ORDER BY requested_at DESC
      LIMIT 50
    `;
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      format: row.format,
      requestedAt: row.requested_at.toISOString(),
      completedAt: row.completed_at?.toISOString() || null,
      errorMessage: row.error_message,
    }));
  }

  async getExportJob(organizationId: string, exportId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        format: string;
        file_storage_path: string | null;
        requested_at: Date;
        completed_at: Date | null;
        error_message: string | null;
      }>
    >`
      SELECT
        id,
        status,
        format,
        file_storage_path,
        requested_at,
        completed_at,
        error_message
      FROM organization_export_jobs
      WHERE id = ${exportId}
        AND organization_id = ${organizationId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Export not found');

    let downloadUrl: string | null = null;
    if (row.status === 'completed' && row.file_storage_path) {
      try {
        const signed = await this.storage.getDownloadUrl(row.file_storage_path);
        downloadUrl = signed.url;
      } catch {
        downloadUrl = null;
      }
    }

    return {
      id: row.id,
      status: row.status,
      format: row.format,
      requestedAt: row.requested_at.toISOString(),
      completedAt: row.completed_at?.toISOString() || null,
      errorMessage: row.error_message,
      downloadUrl,
    };
  }

  async createLegalHold(
    organizationId: string,
    dto: CreateLegalHoldDto,
    user: AuthenticatedUser,
  ) {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO legal_holds (
        id,
        organization_id,
        reason,
        case_reference,
        active,
        created_by_user_id,
        created_at
      ) VALUES (
        ${id},
        ${organizationId},
        ${dto.reason},
        ${dto.caseReference || null},
        true,
        ${user.id},
        NOW()
      )
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'legal_hold',
      entityId: id,
      action: 'legal_hold_created',
      details: {
        caseReference: dto.caseReference || null,
      },
      reason: dto.reason,
    });

    return this.getLegalHold(organizationId, id);
  }

  async listLegalHolds(organizationId: string, activeOnly = false) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        reason: string;
        case_reference: string | null;
        active: boolean;
        created_by_user_id: string | null;
        created_at: Date;
        released_at: Date | null;
        released_by_user_id: string | null;
      }>
    >`
      SELECT
        id,
        reason,
        case_reference,
        active,
        created_by_user_id,
        created_at,
        released_at,
        released_by_user_id
      FROM legal_holds
      WHERE organization_id = ${organizationId}
        AND (${activeOnly} = false OR active = true)
      ORDER BY created_at DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      caseReference: row.case_reference,
      active: row.active,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at.toISOString(),
      releasedAt: row.released_at?.toISOString() || null,
      releasedByUserId: row.released_by_user_id,
    }));
  }

  async getLegalHold(organizationId: string, legalHoldId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        reason: string;
        case_reference: string | null;
        active: boolean;
        created_by_user_id: string | null;
        created_at: Date;
        released_at: Date | null;
        released_by_user_id: string | null;
      }>
    >`
      SELECT
        id,
        reason,
        case_reference,
        active,
        created_by_user_id,
        created_at,
        released_at,
        released_by_user_id
      FROM legal_holds
      WHERE id = ${legalHoldId}
        AND organization_id = ${organizationId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Legal hold not found');
    return {
      id: row.id,
      reason: row.reason,
      caseReference: row.case_reference,
      active: row.active,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at.toISOString(),
      releasedAt: row.released_at?.toISOString() || null,
      releasedByUserId: row.released_by_user_id,
    };
  }

  async releaseLegalHold(
    organizationId: string,
    legalHoldId: string,
    user: AuthenticatedUser,
  ) {
    const hold = await this.getLegalHold(organizationId, legalHoldId);
    if (!hold.active) {
      return hold;
    }

    await this.prisma.$executeRaw`
      UPDATE legal_holds
      SET
        active = false,
        released_at = NOW(),
        released_by_user_id = ${user.id}
      WHERE id = ${legalHoldId}
        AND organization_id = ${organizationId}
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'legal_hold',
      entityId: legalHoldId,
      action: 'legal_hold_released',
      details: {},
    });

    return this.getLegalHold(organizationId, legalHoldId);
  }

  async createCorrectiveAction(
    organizationId: string,
    dto: CreateCorrectiveActionDto,
    user: AuthenticatedUser,
  ) {
    const id = randomUUID();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    await this.prisma.$executeRaw`
      INSERT INTO corrective_actions (
        id,
        organization_id,
        title,
        description,
        owner_user_id,
        due_date,
        status,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${id},
        ${organizationId},
        ${dto.title},
        ${dto.description || null},
        ${dto.ownerUserId || null},
        ${dueDate},
        'open'::"CorrectiveActionStatus",
        ${user.id},
        NOW(),
        NOW()
      )
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'corrective_action',
      entityId: id,
      action: 'corrective_action_created',
      details: {
        title: dto.title,
        ownerUserId: dto.ownerUserId || null,
      },
    });

    return this.getCorrectiveAction(organizationId, id);
  }

  async listCorrectiveActions(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        owner_user_id: string | null;
        due_date: Date | null;
        closure_date: Date | null;
        status: 'open' | 'closed';
        created_by_user_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        id,
        title,
        description,
        owner_user_id,
        due_date,
        closure_date,
        status,
        created_by_user_id,
        created_at,
        updated_at
      FROM corrective_actions
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      ownerUserId: row.owner_user_id,
      dueDate: row.due_date?.toISOString() || null,
      closureDate: row.closure_date?.toISOString() || null,
      status: row.status,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  async getCorrectiveAction(organizationId: string, correctiveActionId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        owner_user_id: string | null;
        due_date: Date | null;
        closure_date: Date | null;
        status: 'open' | 'closed';
        created_by_user_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        id,
        title,
        description,
        owner_user_id,
        due_date,
        closure_date,
        status,
        created_by_user_id,
        created_at,
        updated_at
      FROM corrective_actions
      WHERE id = ${correctiveActionId}
        AND organization_id = ${organizationId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Corrective action not found');
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      ownerUserId: row.owner_user_id,
      dueDate: row.due_date?.toISOString() || null,
      closureDate: row.closure_date?.toISOString() || null,
      status: row.status,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async updateCorrectiveAction(
    organizationId: string,
    correctiveActionId: string,
    dto: UpdateCorrectiveActionDto,
    user: AuthenticatedUser,
  ) {
    const current = await this.getCorrectiveAction(organizationId, correctiveActionId);
    const nextStatus = dto.status || current.status;
    const nextClosureDate =
      dto.closureDate !== undefined
        ? (dto.closureDate ? new Date(dto.closureDate) : null)
        : nextStatus === 'closed' && !current.closureDate
          ? new Date()
          : current.closureDate
            ? new Date(current.closureDate)
            : null;

    await this.prisma.$executeRaw`
      UPDATE corrective_actions
      SET
        title = ${dto.title ?? current.title},
        description = ${dto.description ?? current.description},
        owner_user_id = ${dto.ownerUserId ?? current.ownerUserId},
        due_date = ${dto.dueDate ? new Date(dto.dueDate) : current.dueDate ? new Date(current.dueDate) : null},
        closure_date = ${nextClosureDate},
        status = ${nextStatus}::"CorrectiveActionStatus",
        updated_at = NOW()
      WHERE id = ${correctiveActionId}
        AND organization_id = ${organizationId}
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'corrective_action',
      entityId: correctiveActionId,
      action: 'corrective_action_updated',
      details: {
        fields: Object.keys(dto),
      },
      oldValue: current,
      newValue: await this.getCorrectiveAction(organizationId, correctiveActionId),
    });

    return this.getCorrectiveAction(organizationId, correctiveActionId);
  }

  async getQapiSummary(organizationId: string, days = 90) {
    const startDate = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    const [overrideRows, rejectionRows, lateRenewalRows, discrepancyRows, correctiveRows] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ cnt: number }>>`
          SELECT COUNT(*)::int AS cnt
          FROM audit_events
          WHERE organization_id = ${organizationId}
            AND action = 'override_set'
            AND created_at >= ${startDate}
        `,
        this.prisma.$queryRaw<Array<{ cnt: number }>>`
          SELECT COUNT(*)::int AS cnt
          FROM audit_events
          WHERE organization_id = ${organizationId}
            AND action = 'item_rejected'
            AND created_at >= ${startDate}
        `,
        this.prisma.$queryRaw<Array<{ cnt: number }>>`
          SELECT COUNT(*)::int AS cnt
          FROM audit_events
          WHERE organization_id = ${organizationId}
            AND action = 'item_approved'
            AND old_value_json->>'status' = 'expired'
            AND created_at >= ${startDate}
        `,
        this.prisma.$queryRaw<Array<{ cnt: number }>>`
          SELECT COUNT(*)::int AS cnt
          FROM clinician_checklist_items i
          WHERE i.organization_id = ${organizationId}
            AND i.status = 'rejected'::"ChecklistItemStatus"
            AND i.updated_at >= ${startDate}
        `,
        this.prisma.$queryRaw<Array<{ open_cnt: number; closed_cnt: number }>>`
          SELECT
            SUM(CASE WHEN status = 'open'::"CorrectiveActionStatus" THEN 1 ELSE 0 END)::int AS open_cnt,
            SUM(CASE WHEN status = 'closed'::"CorrectiveActionStatus" THEN 1 ELSE 0 END)::int AS closed_cnt
          FROM corrective_actions
          WHERE organization_id = ${organizationId}
            AND created_at >= ${startDate}
        `,
      ]);

    return {
      rangeDays: days,
      since: startDate.toISOString(),
      totals: {
        overrides: overrideRows[0]?.cnt || 0,
        rejections: rejectionRows[0]?.cnt || 0,
        lateRenewals: lateRenewalRows[0]?.cnt || 0,
        discrepancies: discrepancyRows[0]?.cnt || 0,
        correctiveActionsOpen: correctiveRows[0]?.open_cnt || 0,
        correctiveActionsClosed: correctiveRows[0]?.closed_cnt || 0,
      },
    };
  }

  async getQapiTrends(organizationId: string, days = 90) {
    const startDate = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<
      Array<{
        day: Date;
        overrides: number;
        rejections: number;
        late_renewals: number;
      }>
    >`
      SELECT
        d.day::date AS day,
        COALESCE(o.cnt, 0)::int AS overrides,
        COALESCE(r.cnt, 0)::int AS rejections,
        COALESCE(l.cnt, 0)::int AS late_renewals
      FROM generate_series(${startDate}::timestamp, NOW()::timestamp, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS cnt
        FROM audit_events
        WHERE organization_id = ${organizationId}
          AND action = 'override_set'
          AND created_at >= ${startDate}
        GROUP BY 1
      ) o ON o.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS cnt
        FROM audit_events
        WHERE organization_id = ${organizationId}
          AND action = 'item_rejected'
          AND created_at >= ${startDate}
        GROUP BY 1
      ) r ON r.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS cnt
        FROM audit_events
        WHERE organization_id = ${organizationId}
          AND action = 'item_approved'
          AND old_value_json->>'status' = 'expired'
          AND created_at >= ${startDate}
        GROUP BY 1
      ) l ON l.day = d.day
      ORDER BY d.day ASC
    `;

    return {
      rangeDays: days,
      since: startDate.toISOString(),
      points: rows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        overrides: row.overrides,
        rejections: row.rejections,
        lateRenewals: row.late_renewals,
      })),
    };
  }

  async getPolicyDocuments(organizationId: string, userId: string) {
    const [userRows, orgRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          document_type: 'terms' | 'privacy' | 'baa';
          document_version: string;
          accepted_at: Date;
        }>
      >`
        SELECT DISTINCT ON (document_type)
          document_type,
          document_version,
          accepted_at
        FROM policy_acceptances
        WHERE organization_id = ${organizationId}
          AND user_id = ${userId}
        ORDER BY document_type, accepted_at DESC
      `,
      this.prisma.$queryRaw<
        Array<{
          document_type: 'terms' | 'privacy' | 'baa';
          document_version: string;
          accepted_at: Date;
        }>
      >`
        SELECT DISTINCT ON (document_type)
          document_type,
          document_version,
          accepted_at
        FROM policy_acceptances
        WHERE organization_id = ${organizationId}
        ORDER BY document_type, accepted_at DESC
      `,
    ]);

    const userAcceptance = new Map(
      userRows.map((row) => [
        row.document_type,
        {
          version: row.document_version,
          acceptedAt: row.accepted_at.toISOString(),
        },
      ]),
    );
    const orgAcceptance = new Map(
      orgRows.map((row) => [
        row.document_type,
        {
          version: row.document_version,
          acceptedAt: row.accepted_at.toISOString(),
        },
      ]),
    );

    const documents = [
      {
        documentType: 'terms' as const,
        currentVersion: this.policyVersions.terms,
        title: 'Terms of Service',
        summary:
          'Credentis provides workflow tooling and does not guarantee legal/regulatory compliance.',
      },
      {
        documentType: 'privacy' as const,
        currentVersion: this.policyVersions.privacy,
        title: 'Privacy Policy',
        summary:
          'Defines data handling, retention expectations, and customer responsibilities for uploaded content.',
      },
      {
        documentType: 'baa' as const,
        currentVersion: this.policyVersions.baa,
        title: 'Business Associate Agreement',
        summary:
          'Defines HIPAA-related obligations when PHI processing requires a BAA.',
      },
    ];

    return {
      documents: documents.map((doc) => {
        const userAccepted = userAcceptance.get(doc.documentType);
        const orgAccepted = orgAcceptance.get(doc.documentType);
        return {
          ...doc,
          userAcceptedVersion: userAccepted?.version || null,
          userAcceptedAt: userAccepted?.acceptedAt || null,
          orgAcceptedVersion: orgAccepted?.version || null,
          orgAcceptedAt: orgAccepted?.acceptedAt || null,
          isCurrentVersionAcceptedByUser:
            userAccepted?.version === doc.currentVersion,
        };
      }),
    };
  }

  async acceptPolicy(
    organizationId: string,
    dto: AcceptPolicyDto,
    user: AuthenticatedUser,
  ) {
    const expectedVersion = this.policyVersions[dto.documentType];
    if (dto.documentVersion !== expectedVersion) {
      throw new BadRequestException(
        `Invalid ${dto.documentType} version. Expected ${expectedVersion}.`,
      );
    }

    const acceptanceId = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO policy_acceptances (
        id,
        organization_id,
        user_id,
        document_type,
        document_version,
        accepted_at
      ) VALUES (
        ${acceptanceId},
        ${organizationId},
        ${user.id},
        ${dto.documentType}::"PolicyDocumentType",
        ${dto.documentVersion},
        NOW()
      )
    `;

    await this.auditLogs.log({
      organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'policy_acceptance',
      entityId: acceptanceId,
      action: 'policy_accepted',
      details: {
        documentType: dto.documentType,
        documentVersion: dto.documentVersion,
      },
    });

    return {
      id: acceptanceId,
      documentType: dto.documentType,
      documentVersion: dto.documentVersion,
      acceptedAt: new Date().toISOString(),
    };
  }
}
