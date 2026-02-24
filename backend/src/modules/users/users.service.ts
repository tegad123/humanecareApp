import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../../jobs/email.service.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { Role } from '../../../generated/prisma/client.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async invite(dto: InviteUserDto) {
    // Check org exists
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // Check email not already in use
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    // Create user with a placeholder clerkUserId (updated on first sign-in)
    const placeholderId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const user = await this.prisma.user.create({
      data: {
        organizationId: dto.organizationId,
        clerkUserId: placeholderId,
        email: dto.email,
        name: dto.name || null,
        role: dto.role as Role,
      },
    });

    // Send invite email with sign-in link
    const frontendUrl =
      (this.config.get<string>('FRONTEND_URL') || 'https://credentis.app').split(',')[0].trim();
    const signInUrl = `${frontendUrl}/sign-in`;
    const roleName = dto.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    try {
      await this.emailService.send({
        to: dto.email,
        subject: `You've been invited to join ${org.name} on Credentis`,
        text: [
          `Hi${dto.name ? ` ${dto.name}` : ''},`,
          '',
          `${org.name} has invited you to join their team on Credentis as a ${roleName}.`,
          '',
          `Sign in with this email address to get started:`,
          signInUrl,
          '',
          `Credentis uses passwordless sign-in — you'll receive a magic link to your email when you sign in.`,
          '',
          'Thank you,',
          'Credentis Team',
        ].join('\n'),
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">Welcome to ${org.name}</h2>
            <p>Hi${dto.name ? ` ${dto.name}` : ''},</p>
            <p>${org.name} has invited you to join their team on Credentis as a <strong>${roleName}</strong>.</p>
            <p>Sign in with this email address to get started:</p>
            <p style="margin: 24px 0;">
              <a href="${signInUrl}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Sign In to Credentis
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Credentis uses passwordless sign-in — you'll receive a magic link to your email when you sign in.</p>
            <p style="color: #64748b; font-size: 14px;">Thank you,<br/>Credentis Team</p>
          </div>
        `,
      });
    } catch (emailError: any) {
      this.logger.warn(`Failed to send invite email to ${dto.email}: ${emailError.message}`);
    }

    this.logger.log(`Invited user: ${dto.email} to org ${org.name} as ${dto.role}`);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      message: 'User invited. An email has been sent with sign-in instructions.',
    };
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: { id: true, name: true, planTier: true, planFlags: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async findByClerkId(clerkUserId: string) {
    return this.prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        organization: {
          select: { id: true, name: true, planTier: true },
        },
      },
    });
  }

  async linkClerkUser(email: string, clerkUserId: string) {
    // Find user by email with a pending placeholder clerkUserId
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        clerkUserId: { startsWith: 'pending_' },
      },
    });

    if (!user) return null;

    return this.prisma.user.update({
      where: { id: user.id },
      data: { clerkUserId },
    });
  }

  async updateRole(
    targetUserId: string,
    newRole: string,
    actingUser: { id: string; organizationId: string; role: string },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    // Must be same org
    if (target.organizationId !== actingUser.organizationId) {
      throw new ForbiddenException('Cannot modify users outside your organization');
    }

    // Cannot change your own role
    if (target.id === actingUser.id) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Only super_admin can assign super_admin role
    if (newRole === 'super_admin' && actingUser.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can promote to super admin');
    }

    // Admin cannot change another admin or super_admin
    if (
      actingUser.role === 'admin' &&
      (target.role === 'super_admin' || target.role === 'admin')
    ) {
      throw new ForbiddenException('Admins cannot modify other admins or super admins');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as Role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    this.logger.log(
      `User ${actingUser.id} changed role of ${target.email} from ${target.role} to ${newRole}`,
    );

    return updated;
  }

  async remove(
    targetUserId: string,
    actingUser: { id: string; organizationId: string; role: string },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    // Must be same org
    if (target.organizationId !== actingUser.organizationId) {
      throw new ForbiddenException('Cannot remove users outside your organization');
    }

    // Cannot remove yourself
    if (target.id === actingUser.id) {
      throw new ForbiddenException('Cannot remove yourself');
    }

    // Admin cannot remove another admin or super_admin
    if (
      actingUser.role === 'admin' &&
      (target.role === 'super_admin' || target.role === 'admin')
    ) {
      throw new ForbiddenException('Admins cannot remove other admins or super admins');
    }

    await this.prisma.user.delete({ where: { id: targetUserId } });

    this.logger.log(
      `User ${actingUser.id} removed team member ${target.email} (${target.role})`,
    );

    return { message: 'Team member removed' };
  }
}
