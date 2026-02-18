import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Role } from '../../../generated/prisma/client.js';

interface LogParams {
  organizationId: string;
  actorUserId?: string;
  actorRole?: Role;
  clinicianId?: string;
  entityType: string;
  entityId: string;
  action: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogParams) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole || null,
        clinicianId: params.clinicianId || null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        detailsJson: params.details ?? Prisma.JsonNull,
      },
    });
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
