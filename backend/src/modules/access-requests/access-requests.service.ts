import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../../jobs/email.service.js';
import { CreateAccessRequestDto } from './dto/create-access-request.dto.js';
import { Role } from '../../../generated/prisma/client.js';

@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);
  private readonly apiUrl: string;
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {
    this.apiUrl =
      this.config.get<string>('API_URL') || 'https://api.credentis.app/api';
    this.frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'https://credentis.app'
    )
      .split(',')[0]
      .trim();
  }

  // ─── Create ──────────────────────────────────────────

  async create(dto: CreateAccessRequestDto) {
    const approvalToken = randomUUID();

    const request = await this.prisma.accessRequest.create({
      data: {
        agencyName: dto.agencyName,
        requesterName: dto.requesterName,
        workEmail: dto.workEmail,
        phone: dto.phone || null,
        state: dto.state || null,
        estimatedClinicianCount: dto.estimatedClinicianCount || null,
        emr: dto.emr || null,
        approvalToken,
      },
    });

    // Notify admins with approve/reject buttons
    await this.notifySuperAdmins(request);

    return { id: request.id, message: 'Access request submitted successfully' };
  }

  // ─── Read ────────────────────────────────────────────

  async findAll(filters?: { status?: string }) {
    const where: Record<string, any> = {};
    if (filters?.status) where.status = filters.status;

    return this.prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Access request not found');
    return request;
  }

  // ─── Legacy status update (dashboard) ────────────────

  async updateStatus(id: string, status: string, reviewNotes?: string) {
    await this.findOne(id);
    return this.prisma.accessRequest.update({
      where: { id },
      data: {
        status: status as any,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    });
  }

  // ─── Approve by email token ──────────────────────────

  async approveByToken(token: string) {
    const request = await this.prisma.$transaction(async (tx) => {
      const pendingRequest = await tx.accessRequest.findUnique({
        where: { approvalToken: token },
      });

      if (!pendingRequest) {
        throw new NotFoundException('Invalid or expired approval link.');
      }
      if (pendingRequest.status !== 'pending') {
        throw new BadRequestException(
          `This request has already been ${pendingRequest.status}.`,
        );
      }

      const org = await tx.organization.create({
        data: {
          name: pendingRequest.agencyName,
          planTier: 'starter',
          planFlags: { ai_doc_intelligence: false, sms_reminders: false },
        },
      });
      this.logger.log(`Created organization "${org.name}" (${org.id})`);

      const placeholderId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          clerkUserId: placeholderId,
          email: pendingRequest.workEmail,
          name: pendingRequest.requesterName,
          role: 'admin' as Role,
        },
      });
      this.logger.log(
        `Created admin user "${user.email}" (${user.id}) for org ${org.id}`,
      );

      const consumed = await tx.accessRequest.updateMany({
        where: {
          id: pendingRequest.id,
          status: 'pending',
          approvalToken: token,
        },
        data: {
          status: 'approved',
          approvalToken: null,
          reviewedAt: new Date(),
          reviewNotes: 'Approved via email link',
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(
          'This request has already been approved.',
        );
      }

      return pendingRequest;
    });

    await this.sendWelcomeEmail(request);

    return {
      agencyName: request.agencyName,
      requesterName: request.requesterName,
      workEmail: request.workEmail,
    };
  }

  // ─── Reject by email token ───────────────────────────

  async rejectByToken(token: string) {
    const request = await this.prisma.$transaction(async (tx) => {
      const pendingRequest = await tx.accessRequest.findUnique({
        where: { approvalToken: token },
      });

      if (!pendingRequest) {
        throw new NotFoundException('Invalid or expired rejection link.');
      }
      if (pendingRequest.status !== 'pending') {
        throw new BadRequestException(
          `This request has already been ${pendingRequest.status}.`,
        );
      }

      const consumed = await tx.accessRequest.updateMany({
        where: {
          id: pendingRequest.id,
          status: 'pending',
          approvalToken: token,
        },
        data: {
          status: 'rejected',
          approvalToken: null,
          reviewedAt: new Date(),
          reviewNotes: 'Rejected via email link',
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(
          'This request has already been rejected.',
        );
      }

      return pendingRequest;
    });

    await this.sendRejectionEmail(request);

    return {
      agencyName: request.agencyName,
      requesterName: request.requesterName,
    };
  }

  // ─── Admin notification email (with approve/reject buttons) ──────

  private async notifySuperAdmins(request: any) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'super_admin' },
      select: { email: true },
    });

    const configuredAdminEmail = this.config
      .get<string>('ADMIN_NOTIFICATION_EMAIL')
      ?.trim();
    const emails = new Set(
      [
        configuredAdminEmail,
        ...superAdmins.map((a: { email: string }) => a.email?.trim()),
      ]
        .filter((email): email is string => !!email)
        .map((email) => email.toLowerCase()),
    );

    if (emails.size === 0) {
      this.logger.warn(
        `No admin notification recipients found for access request ${request.id}. Configure ADMIN_NOTIFICATION_EMAIL or create a super_admin user.`,
      );
      return;
    }

    const approveUrl = `${this.apiUrl}/access-requests/approve/${request.approvalToken}`;
    const rejectUrl = `${this.apiUrl}/access-requests/reject/${request.approvalToken}`;

    const text = [
      `New agency access request:`,
      '',
      `Agency: ${request.agencyName}`,
      `Contact: ${request.requesterName} (${request.workEmail})`,
      `Phone: ${request.phone || 'Not provided'}`,
      `State: ${request.state || 'Not provided'}`,
      `Est. Clinicians: ${request.estimatedClinicianCount || 'Not provided'}`,
      `EMR: ${request.emr || 'Not provided'}`,
      '',
      `Approve: ${approveUrl}`,
      `Reject: ${rejectUrl}`,
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">
            New Access Request
          </h1>
        </div>

        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 24px; font-size: 15px; line-height: 1.5;">
            A new agency has requested access to Credentis.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; width: 140px;">Agency</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${request.agencyName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9;">Contact</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #f1f5f9;">${request.requesterName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9;">Email</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #f1f5f9;">
                <a href="mailto:${request.workEmail}" style="color: #2563eb; text-decoration: none;">${request.workEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9;">Phone</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #f1f5f9;">${request.phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9;">State</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #f1f5f9;">${request.state || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9;">Est. Clinicians</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #f1f5f9;">${request.estimatedClinicianCount || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">EMR</td>
              <td style="padding: 10px 12px; color: #1e293b; font-size: 15px;">${request.emr || 'Not provided'}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-bottom: 16px;">
            <a href="${approveUrl}"
               style="display: inline-block; background: #16a34a; color: #ffffff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-right: 12px;">
              &#10003; Approve
            </a>
            <a href="${rejectUrl}"
               style="display: inline-block; background: #dc2626; color: #ffffff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              &#10007; Reject
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 24px 0 0;">
            Clicking Approve will create the agency's organization, set up their admin account, and send them a sign-in link.
          </p>
        </div>
      </div>
    `;

    for (const email of emails) {
      await this.emailService
        .send({
          to: email,
          subject: `[Credentis] New Access Request: ${request.agencyName}`,
          text,
          html,
        })
        .catch((err) =>
          this.logger.error(`Failed to notify ${email}: ${err.message}`),
        );
    }
  }

  // ─── Welcome email to approved requester ─────────────

  private async sendWelcomeEmail(request: any) {
    const signInUrl = `${this.frontendUrl}/sign-in`;

    const text = [
      `Hi ${request.requesterName},`,
      '',
      `Great news! Your Credentis access request for ${request.agencyName} has been approved.`,
      '',
      `Your admin account is ready. Sign in using your email (${request.workEmail}) at:`,
      signInUrl,
      '',
      `Credentis uses passwordless sign-in — you'll receive a magic link to your email when you sign in.`,
      '',
      'Thank you,',
      'Credentis Team',
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">
            Welcome to Credentis
          </h1>
        </div>

        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 8px; font-size: 15px;">Hi ${request.requesterName},</p>

          <p style="color: #334155; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Great news! Your access request for <strong>${request.agencyName}</strong> has been approved.
            Your admin account is ready to go.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="color: #64748b; margin: 0 0 4px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Sign in with</p>
            <p style="color: #1e293b; margin: 0; font-size: 16px; font-weight: 600;">${request.workEmail}</p>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${signInUrl}"
               style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Sign In to Credentis
            </a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
            Credentis uses passwordless sign-in. When you click "Sign In", you'll receive a magic link to your email — no password needed.
          </p>

          <p style="color: #64748b; font-size: 13px; margin: 16px 0 0;">
            Thank you,<br/>Credentis Team
          </p>
        </div>
      </div>
    `;

    await this.emailService
      .send({
        to: request.workEmail,
        subject: `Your Credentis account is ready — ${request.agencyName}`,
        text,
        html,
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send welcome email to ${request.workEmail}: ${err.message}`,
        ),
      );
  }

  // ─── Rejection email to requester ────────────────────

  private async sendRejectionEmail(request: any) {
    const text = [
      `Hi ${request.requesterName},`,
      '',
      `Thank you for your interest in Credentis. After reviewing your access request for ${request.agencyName}, we're unable to approve it at this time.`,
      '',
      `If you believe this was in error or have additional information, please reach out to us at support@credentis.com.`,
      '',
      'Thank you,',
      'Credentis Team',
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">
            Credentis Access Request Update
          </h1>
        </div>

        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; margin: 0 0 8px; font-size: 15px;">Hi ${request.requesterName},</p>

          <p style="color: #334155; margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
            Thank you for your interest in Credentis. After reviewing your access request
            for <strong>${request.agencyName}</strong>, we're unable to approve it at this time.
          </p>

          <p style="color: #334155; margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
            If you believe this was in error or have additional information, please contact us at
            <a href="mailto:support@credentis.com" style="color: #2563eb; text-decoration: none;">support@credentis.com</a>.
          </p>

          <p style="color: #64748b; font-size: 13px; margin: 16px 0 0;">
            Thank you,<br/>Credentis Team
          </p>
        </div>
      </div>
    `;

    await this.emailService
      .send({
        to: request.workEmail,
        subject: `Credentis Access Request Update — ${request.agencyName}`,
        text,
        html,
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send rejection email to ${request.workEmail}: ${err.message}`,
        ),
      );
  }
}
