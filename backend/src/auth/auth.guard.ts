import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
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

      const user = await this.prisma.user.findUnique({
        where: { clerkUserId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found in system');
      }

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        email: user.email,
        clerkUserId: user.clerkUserId,
      };

      request.user = authenticatedUser;
      return true;
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
}
