import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { Role } from '../../../generated/prisma/client.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

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

    // In production, send Clerk invitation email here
    // For dev, just log it
    this.logger.log(`Invited user: ${dto.email} to org ${org.name} as ${dto.role}`);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      message: 'User created. In production, a Clerk invitation email would be sent.',
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
}
