import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../../jobs/email.service.js';
import { CreateAccessRequestDto } from './dto/create-access-request.dto.js';

/** Hardcoded fallback — always receives access request notifications */
const DEFAULT_ADMIN_EMAIL = 'tegad8@gmail.com';

@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateAccessRequestDto) {
    const request = await this.prisma.accessRequest.create({
      data: {
        agencyName: dto.agencyName,
        requesterName: dto.requesterName,
        workEmail: dto.workEmail,
        phone: dto.phone || null,
        state: dto.state || null,
        estimatedClinicianCount: dto.estimatedClinicianCount || null,
        emr: dto.emr || null,
      },
    });

    // Notify all super_admins
    await this.notifySuperAdmins(request);

    return { id: request.id, message: 'Access request submitted successfully' };
  }

  async findAll(filters?: { status?: string }) {
    const where: Record<string, any> = {};
    if (filters?.status) where.status = filters.status;

    return this.prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Access request not found');
    return request;
  }

  async updateStatus(id: string, status: string, reviewNotes?: string) {
    await this.findOne(id); // Ensure it exists
    return this.prisma.accessRequest.update({
      where: { id },
      data: {
        status: status as any,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    });
  }

  private async notifySuperAdmins(request: any) {
    // Collect unique emails: DB super_admins + hardcoded admin email
    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'super_admin' },
      select: { email: true },
    });

    const adminEmail =
      this.config.get<string>('ADMIN_NOTIFICATION_EMAIL') || DEFAULT_ADMIN_EMAIL;
    const emails = new Set([
      adminEmail,
      ...superAdmins.map((a) => a.email),
    ]);

    const emailBody = [
      `A new agency access request has been submitted.`,
      '',
      `Agency: ${request.agencyName}`,
      `Contact: ${request.requesterName} (${request.workEmail})`,
      `Phone: ${request.phone || 'Not provided'}`,
      `State: ${request.state || 'Not provided'}`,
      `Est. Clinicians: ${request.estimatedClinicianCount || 'Not provided'}`,
      `EMR: ${request.emr || 'Not provided'}`,
      '',
      `Please review this request in the Credentis admin dashboard.`,
    ].join('\n');

    for (const email of emails) {
      await this.emailService
        .send({
          to: email,
          subject: `[Credentis] New Access Request: ${request.agencyName}`,
          text: emailBody,
        })
        .catch((err) =>
          this.logger.error(`Failed to notify ${email}: ${err.message}`),
        );
    }
  }
}
