import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Role } from '../../../generated/prisma/client.js';
import { createHash, randomUUID } from 'crypto';
import { getRequestContext } from '../../common/request-context.js';

interface LogParams {
  organizationId: string;
  actorUserId?: string;
  actorRole?: Role;
  clinicianId?: string;
  entityType: string;
  entityId: string;
  action: string;
  details?: Record<string, any>;
  reason?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private prisma: PrismaService) {}

  private normalizeJsonValue(input: unknown): Prisma.InputJsonValue {
    if (input === null || input === undefined) {
      return Prisma.JsonNull;
    }
    return input as Prisma.InputJsonValue;
  }

  private canonicalizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.canonicalizeValue(item));
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) {
        out[key] = this.canonicalizeValue(obj[key]);
      }
      return out;
    }
    return value;
  }

  private canonicalizePayload(payload: Record<string, unknown>): string {
    return JSON.stringify(this.canonicalizeValue(payload));
  }

  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private async appendTamperEvidentEvent(
    params: LogParams,
    context: {
      requestId: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: Date;
    },
  ) {
    const previousRows = await this.prisma.$queryRaw<
      Array<{ event_hash: string }>
    >`
      SELECT event_hash
      FROM audit_events
      WHERE organization_id = ${params.organizationId}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;

    const prevHash = previousRows[0]?.event_hash || null;

    const payloadCanonical = this.canonicalizePayload({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId || null,
      actorRole: params.actorRole || null,
      clinicianId: params.clinicianId || null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      reason: params.reason || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      details: params.details || null,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      createdAt: context.createdAt.toISOString(),
    });
    const eventHash = this.sha256(`${prevHash || ''}|${payloadCanonical}`);

    await this.prisma.$executeRaw`
      INSERT INTO audit_events (
        id,
        organization_id,
        actor_user_id,
        actor_role,
        clinician_id,
        entity_type,
        entity_id,
        action,
        request_id,
        ip_address,
        user_agent,
        reason,
        old_value_json,
        new_value_json,
        details_json,
        payload_canonical,
        prev_hash,
        event_hash,
        created_at
      ) VALUES (
        ${randomUUID()},
        ${params.organizationId},
        ${params.actorUserId || null},
        ${params.actorRole || null},
        ${params.clinicianId || null},
        ${params.entityType},
        ${params.entityId},
        ${params.action},
        ${context.requestId},
        ${context.ipAddress},
        ${context.userAgent},
        ${params.reason || null},
        ${this.normalizeJsonValue(params.oldValue)},
        ${this.normalizeJsonValue(params.newValue)},
        ${this.normalizeJsonValue(params.details)},
        ${payloadCanonical},
        ${prevHash},
        ${eventHash},
        ${context.createdAt}
      )
    `;
  }

  async log(params: LogParams) {
    const requestContext = getRequestContext();
    const createdAt = new Date();
    const requestId = params.requestId || requestContext?.requestId || randomUUID();
    const ipAddress = params.ipAddress || requestContext?.ipAddress || null;
    const userAgent = params.userAgent || requestContext?.userAgent || null;

    const baseLog = await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole || null,
        clinicianId: params.clinicianId || null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        detailsJson: params.details ?? Prisma.JsonNull,
        createdAt,
      },
    });

    try {
      await this.appendTamperEvidentEvent(params, {
        requestId,
        ipAddress,
        userAgent,
        createdAt,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to append tamper-evident audit event for ${params.action} (${params.entityType}:${params.entityId})`,
      );
      this.logger.debug(error);
    }

    return baseLog;
  }

  async findByOrganization(
    organizationId: string,
    options?: { clinicianId?: string; limit?: number; offset?: number },
  ) {
    const where: any = { organizationId };
    if (options?.clinicianId) where.clinicianId = options.clinicianId;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        actorUser: { select: { id: true, name: true, email: true, role: true } },
        clinician: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
