import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { ChecklistTemplatesService } from '../checklist-templates/checklist-templates.service.js';
import { EmailService } from '../../jobs/email.service.js';
import { EmailSettingsService } from '../email-settings/email-settings.service.js';
import { CreateClinicianDto } from './dto/create-clinician.dto.js';
import { UpdateClinicianDto } from './dto/update-clinician.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { Discipline, ClinicianStatus } from '../../../generated/prisma/client.js';
import { randomUUID } from 'crypto';

@Injectable()
export class CliniciansService {
  private readonly logger = new Logger(CliniciansService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private templates: ChecklistTemplatesService,
    @Inject(forwardRef(() => EmailService)) private emailService: EmailService,
    @Inject(forwardRef(() => EmailSettingsService)) private emailSettings: EmailSettingsService,
    private config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Create a clinician and instantiate all checklist items from the template.
   * Uses a $transaction to ensure atomicity.
   */
  async create(dto: CreateClinicianDto, user: AuthenticatedUser) {
    // Validate template exists and is accessible
    const template = await this.templates.findOne(dto.templateId, user.organizationId);
    if (!template) throw new BadRequestException('Template not found');

    const definitions = await this.templates.getDefinitions(dto.templateId, { enabledOnly: true });
    if (definitions.length === 0) {
      throw new BadRequestException('Template has no enabled item definitions');
    }

    // Generate invite token
    const inviteToken = randomUUID();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.prisma.$transaction(async (tx) => {
      // Create the clinician
      const clinician = await tx.clinician.create({
        data: {
          organizationId: user.organizationId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          discipline: dto.discipline as Discipline,
          templateId: dto.templateId,
          assignedRecruiterId: dto.assignedRecruiterId || null,
          npi: dto.npi || null,
          coverageArea: dto.coverageArea || null,
          notes: dto.notes || null,
          status: 'onboarding' as ClinicianStatus,
          inviteToken,
          inviteExpiresAt,
        },
      });

      // Instantiate all checklist items from template definitions
      await tx.clinicianChecklistItem.createMany({
        data: definitions.map((def) => ({
          organizationId: user.organizationId,
          clinicianId: clinician.id,
          itemDefinitionId: def.id,
          status: 'not_started' as const,
        })),
      });

      return clinician;
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      clinicianId: result.id,
      entityType: 'clinician',
      entityId: result.id,
      action: 'clinician_created',
      details: {
        name: `${dto.firstName} ${dto.lastName}`,
        discipline: dto.discipline,
        template: template.name,
        itemCount: definitions.length,
      },
    });

    // Send invite email (fire-and-forget, don't block creation)
    const inviteUrl = `${this.frontendUrl}/clinician/invite/${inviteToken}`;
    this.sendInviteWithSettings(dto.email, `${dto.firstName} ${dto.lastName}`, user.organizationId, inviteUrl, definitions)
      .catch((err) => this.logger.error(`Failed to send invite email to ${dto.email}: ${err.message}`));

    return result;
  }

  /**
   * List clinicians for an organization with optional filters.
   */
  async findAll(
    organizationId: string,
    filters?: {
      status?: string;
      discipline?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { organizationId };

    if (filters?.status) where.status = filters.status;
    if (filters?.discipline) where.discipline = filters.discipline;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [clinicians, total] = await Promise.all([
      this.prisma.clinician.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 25,
        skip: filters?.offset || 0,
        include: {
          template: { select: { id: true, name: true } },
          assignedRecruiter: { select: { id: true, name: true, email: true } },
          _count: { select: { checklistItems: true } },
        },
      }),
      this.prisma.clinician.count({ where }),
    ]);

    // Get progress for each clinician
    const cliniciansWithProgress = await Promise.all(
      clinicians.map(async (c) => {
        const progress = await this.getProgress(c.id, organizationId);
        return { ...c, progress };
      }),
    );

    return { clinicians: cliniciansWithProgress, total };
  }

  async findByClerkUser(clerkUserId: string) {
    const clinician = await this.prisma.clinician.findFirst({
      where: { clerkUserId },
      include: {
        template: { select: { id: true, name: true, discipline: true } },
      },
    });
    if (!clinician) throw new NotFoundException('Clinician profile not found');
    return clinician;
  }

  async findOne(id: string, organizationId: string) {
    const clinician = await this.prisma.clinician.findFirst({
      where: { id, organizationId },
      include: {
        template: { select: { id: true, name: true, discipline: true } },
        assignedRecruiter: { select: { id: true, name: true, email: true } },
      },
    });
    if (!clinician) throw new NotFoundException('Clinician not found');
    return clinician;
  }

  async update(id: string, dto: UpdateClinicianDto, user: AuthenticatedUser) {
    await this.findOne(id, user.organizationId);

    const updated = await this.prisma.clinician.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.assignedRecruiterId !== undefined && { assignedRecruiterId: dto.assignedRecruiterId }),
        ...(dto.npi !== undefined && { npi: dto.npi }),
        ...(dto.coverageArea !== undefined && { coverageArea: dto.coverageArea }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      clinicianId: id,
      entityType: 'clinician',
      entityId: id,
      action: 'clinician_updated',
      details: { fields: Object.keys(dto) },
    });

    return updated;
  }

  /**
   * Get checklist progress for a clinician.
   */
  async getProgress(clinicianId: string, organizationId: string) {
    const items = await this.prisma.clinicianChecklistItem.findMany({
      where: { clinicianId, organizationId },
      include: {
        itemDefinition: { select: { required: true, blocking: true } },
      },
    });

    const total = items.length;
    const completed = items.filter((i) => i.status === 'approved').length;
    const submitted = items.filter((i) => i.status === 'submitted' || i.status === 'pending_review').length;
    const rejected = items.filter((i) => i.status === 'rejected').length;
    const expired = items.filter((i) => i.status === 'expired').length;
    const notStarted = items.filter((i) => i.status === 'not_started').length;

    const requiredItems = items.filter((i) => i.itemDefinition.required);
    const requiredCompleted = requiredItems.filter((i) => i.status === 'approved').length;

    const blockingItems = items.filter((i) => i.itemDefinition.blocking);
    const blockingCompleted = blockingItems.filter((i) => i.status === 'approved').length;
    const blockingTotal = blockingItems.length;

    return {
      total,
      completed,
      submitted,
      rejected,
      expired,
      notStarted,
      requiredTotal: requiredItems.length,
      requiredCompleted,
      blockingTotal,
      blockingCompleted,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Get KPI stats for the organization dashboard.
   */
  async getStats(organizationId: string) {
    const [total, ready, onboarding, notReady, inactive] = await Promise.all([
      this.prisma.clinician.count({ where: { organizationId } }),
      this.prisma.clinician.count({ where: { organizationId, status: 'ready' } }),
      this.prisma.clinician.count({ where: { organizationId, status: 'onboarding' } }),
      this.prisma.clinician.count({ where: { organizationId, status: 'not_ready' } }),
      this.prisma.clinician.count({ where: { organizationId, status: 'inactive' } }),
    ]);

    return { total, ready, onboarding, notReady, inactive };
  }

  /**
   * Get items that are expiring soon across the organization.
   * Used for the dashboard "Upcoming Expirations" widget.
   */
  async getExpiringItems(
    organizationId: string,
    options?: { daysAhead?: number; limit?: number },
  ) {
    const daysAhead = options?.daysAhead ?? 30;
    const limit = options?.limit ?? 20;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const items = await this.prisma.clinicianChecklistItem.findMany({
      where: {
        organizationId,
        status: 'approved',
        expiresAt: {
          lte: cutoffDate,
          gt: new Date(),
        },
      },
      include: {
        itemDefinition: {
          select: { label: true, blocking: true, section: true },
        },
        clinician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            discipline: true,
            status: true,
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    const expiredItems = await this.prisma.clinicianChecklistItem.findMany({
      where: {
        organizationId,
        status: 'expired',
      },
      include: {
        itemDefinition: {
          select: { label: true, blocking: true, section: true },
        },
        clinician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            discipline: true,
            status: true,
          },
        },
      },
      orderBy: { expiresAt: 'desc' },
      take: limit,
    });

    return {
      expiringSoon: items.map((i) => ({
        id: i.id,
        label: i.itemDefinition.label,
        section: i.itemDefinition.section,
        blocking: i.itemDefinition.blocking,
        expiresAt: i.expiresAt,
        daysRemaining: i.expiresAt
          ? Math.ceil(
              (i.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            )
          : null,
        clinician: i.clinician,
      })),
      expired: expiredItems.map((i) => ({
        id: i.id,
        label: i.itemDefinition.label,
        section: i.itemDefinition.section,
        blocking: i.itemDefinition.blocking,
        expiresAt: i.expiresAt,
        clinician: i.clinician,
      })),
    };
  }

  /**
   * Add an internal note to a clinician.
   */
  async addNote(clinicianId: string, content: string, user: AuthenticatedUser) {
    await this.findOne(clinicianId, user.organizationId);

    return this.prisma.internalNote.create({
      data: {
        organizationId: user.organizationId,
        clinicianId,
        authorUserId: user.id,
        content,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * Get internal notes for a clinician.
   */
  async getNotes(clinicianId: string, organizationId: string) {
    return this.prisma.internalNote.findMany({
      where: { clinicianId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  // ── Invite Flow ──────────────────────────────────────────────

  /**
   * Find a clinician by invite token.
   */
  async findByInviteToken(token: string) {
    const clinician = await this.prisma.clinician.findUnique({
      where: { inviteToken: token },
      include: {
        organization: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
    });
    if (!clinician) throw new NotFoundException('Invalid invite token');
    return clinician;
  }

  /**
   * Validate an invite token and return sanitized clinician info.
   */
  async validateInviteToken(token: string) {
    const clinician = await this.findByInviteToken(token);

    if (clinician.clerkUserId) {
      throw new BadRequestException('Invite has already been accepted');
    }
    if (clinician.inviteExpiresAt && clinician.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    return {
      clinicianId: clinician.id,
      firstName: clinician.firstName,
      lastName: clinician.lastName,
      email: clinician.email,
      discipline: clinician.discipline,
      organizationName: clinician.organization.name,
    };
  }

  /**
   * Link a Clerk user ID to a clinician after signup.
   */
  async linkClerkUser(inviteToken: string, clerkUserId: string) {
    const clinician = await this.findByInviteToken(inviteToken);

    if (clinician.clerkUserId) {
      throw new BadRequestException('Invite has already been accepted');
    }
    if (clinician.inviteExpiresAt && clinician.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    // Ensure no other clinician has this Clerk ID
    const existing = await this.prisma.clinician.findUnique({
      where: { clerkUserId },
    });
    if (existing) {
      throw new ConflictException('This account is already linked to a clinician');
    }

    const updated = await this.prisma.clinician.update({
      where: { id: clinician.id },
      data: {
        clerkUserId,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    await this.auditLogs.log({
      organizationId: clinician.organizationId,
      actorRole: 'clinician' as any,
      clinicianId: clinician.id,
      entityType: 'clinician',
      entityId: clinician.id,
      action: 'invite_accepted',
      details: { clerkUserId },
    });

    return updated;
  }

  /**
   * Resend an invite to a clinician (admin action).
   */
  async resendInvite(clinicianId: string, user: AuthenticatedUser) {
    const clinician = await this.findOne(clinicianId, user.organizationId);

    if (clinician.clerkUserId) {
      throw new BadRequestException('Clinician has already accepted their invite');
    }

    const inviteToken = randomUUID();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.clinician.update({
      where: { id: clinicianId },
      data: { inviteToken, inviteExpiresAt },
    });

    // Send invite email with org email settings
    const inviteUrl = `${this.frontendUrl}/clinician/invite/${inviteToken}`;
    const definitions = clinician.templateId
      ? await this.templates.getDefinitions(clinician.templateId, { enabledOnly: true })
      : [];
    this.sendInviteWithSettings(
      clinician.email,
      `${clinician.firstName} ${clinician.lastName}`,
      user.organizationId,
      inviteUrl,
      definitions,
    ).catch((err) => this.logger.error(`Failed to resend invite: ${err.message}`));

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      clinicianId,
      entityType: 'clinician',
      entityId: clinicianId,
      action: 'invite_resent',
      details: { email: clinician.email },
    });

    return updated;
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Send invite email with org-specific email settings and required items list.
   */
  private async sendInviteWithSettings(
    email: string,
    name: string,
    organizationId: string,
    inviteUrl: string,
    definitions: Array<{ label: string; required: boolean }>,
  ) {
    const [orgEmailSettings, org] = await Promise.all([
      this.emailSettings.get(organizationId),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    ]);

    const orgName = org?.name || 'Your Agency';
    const requiredItems = definitions.filter(d => d.required).map(d => d.label);

    await this.emailService.sendClinicianInvite(email, name, orgName, inviteUrl, {
      emailSettings: orgEmailSettings,
      requiredItems: requiredItems.length > 0 ? requiredItems : undefined,
    });
  }
}
