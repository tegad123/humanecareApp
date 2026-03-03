import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from './decorators/index.js';
import { AuthenticatedUser } from '../common/interfaces.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
      });

      const clerkUserId = payload.sub;

      // Try users table first (admin/staff — most frequent)
      const user = await this.prisma.user.findUnique({
        where: { clerkUserId },
      });

      if (user) {
        const authenticatedUser: AuthenticatedUser = {
          id: user.id,
          organizationId: user.organizationId,
          role: user.role,
          email: user.email,
          clerkUserId: user.clerkUserId,
          entityType: 'user',
        };
        await this.enforceOrganizationAccessMode(request, authenticatedUser.organizationId);
        request.user = authenticatedUser;
        return true;
      }

      // Fallback: try clinicians table
      const clinician = await this.prisma.clinician.findUnique({
        where: { clerkUserId },
      });

      if (clinician) {
        // Check if there's a pending admin User with the same email.
        // Admin accounts always take priority over clinician accounts.
        const pendingAdminUser = await this.prisma.user.findFirst({
          where: { email: clinician.email, clerkUserId: { startsWith: 'pending_' } },
        });

        if (pendingAdminUser) {
          // Atomically link admin User and unlink Clinician to prevent partial state
          const updated = await this.prisma.$transaction(async (tx) => {
            const u = await tx.user.update({
              where: { id: pendingAdminUser.id },
              data: { clerkUserId },
            });
            await tx.clinician.update({
              where: { id: clinician.id },
              data: { clerkUserId: null },
            });
            return u;
          });

          const authenticatedUser: AuthenticatedUser = {
            id: updated.id,
            organizationId: updated.organizationId,
            role: updated.role,
            email: updated.email,
            clerkUserId: updated.clerkUserId,
            entityType: 'user',
          };
          await this.enforceOrganizationAccessMode(request, authenticatedUser.organizationId);
          request.user = authenticatedUser;
          this.logger.log(
            `Resolved admin/clinician conflict for ${clinician.email}: prioritized admin role (${updated.role})`,
          );
          return true;
        }

        const authenticatedUser: AuthenticatedUser = {
          id: clinician.id,
          organizationId: clinician.organizationId,
          role: 'clinician' as any,
          email: clinician.email,
          clerkUserId: clinician.clerkUserId!,
          entityType: 'clinician',
          clinicianId: clinician.id,
        };
        await this.enforceOrganizationAccessMode(request, authenticatedUser.organizationId);
        request.user = authenticatedUser;
        return true;
      }

      // Attempt auto-link: user may have been invited (pending_ clerkUserId)
      try {
        const clerkClient = createClerkClient({
          secretKey: this.config.get<string>('CLERK_SECRET_KEY')!,
        });
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const email =
          clerkUser.emailAddresses?.[0]?.emailAddress;

        if (email) {
          const pendingUser = await this.prisma.user.findFirst({
            where: { email, clerkUserId: { startsWith: 'pending_' } },
          });

          if (pendingUser) {
            const updated = await this.prisma.user.update({
              where: { id: pendingUser.id },
              data: { clerkUserId },
            });

            const authenticatedUser: AuthenticatedUser = {
              id: updated.id,
              organizationId: updated.organizationId,
              role: updated.role,
              email: updated.email,
              clerkUserId: updated.clerkUserId,
              entityType: 'user',
            };
            await this.enforceOrganizationAccessMode(request, authenticatedUser.organizationId);
            request.user = authenticatedUser;
            this.logger.log(
              `Auto-linked invited user ${email} (${updated.role}) on first sign-in`,
            );
            return true;
          }
        }
      } catch (linkError) {
        this.logger.warn('Auto-link attempt failed', linkError);
      }

      throw new UnauthorizedException('User not found in system');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('Token verification failed', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private isAllowedMutatingRouteInReadOnly(pathname: string): boolean {
    return (
      pathname.includes('/billing/') ||
      pathname.includes('/exports') ||
      pathname.includes('/jobs/reminder-health')
    );
  }

  private async enforceOrganizationAccessMode(request: any, organizationId: string) {
    let mode: 'active' | 'read_only' | 'suspended' = 'active';
    let gracePeriodEndsAt: Date | null = null;
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          access_mode: 'active' | 'read_only' | 'suspended';
          grace_period_ends_at: Date | null;
        }>
      >`
        SELECT access_mode, grace_period_ends_at
        FROM organizations
        WHERE id = ${organizationId}
        LIMIT 1
      `;
      mode = rows[0]?.access_mode || 'active';
      gracePeriodEndsAt = rows[0]?.grace_period_ends_at || null;
    } catch {
      // If migrations aren't applied yet, fail open to maintain auth availability.
      return;
    }

    const method = String(request.method || 'GET').toUpperCase();
    const pathname = String(request.originalUrl || request.url || '').split('?')[0];
    const isReadMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (mode === 'suspended') {
      if (!pathname.includes('/billing/')) {
        throw new ForbiddenException(
          'Organization access is suspended. Contact support or resolve billing to restore access.',
        );
      }
      return;
    }

    if (mode === 'read_only') {
      if (gracePeriodEndsAt && gracePeriodEndsAt.getTime() < Date.now()) {
        if (!pathname.includes('/billing/')) {
          throw new ForbiddenException(
            'Read-only grace period has ended. Account is suspended pending billing resolution.',
          );
        }
        return;
      }

      if (!isReadMethod && !this.isAllowedMutatingRouteInReadOnly(pathname)) {
        throw new ForbiddenException(
          'Organization is in read-only mode. Write operations are disabled during billing grace period.',
        );
      }
    }
  }
}
