import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators/index.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobRunsService } from './job-runs.service.js';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobRuns: JobRunsService,
  ) {}

  @Get('reminder-health')
  @Roles('super_admin', 'admin', 'compliance')
  async getReminderHealth(@CurrentUser() user: any) {
    const authUser = user as AuthenticatedUser;
    const rows = await this.prisma.$queryRaw<Array<{ timezone: string | null }>>`
      SELECT timezone
      FROM organizations
      WHERE id = ${authUser.organizationId}
      LIMIT 1
    `;
    const timezone = rows[0]?.timezone || null;
    return this.jobRuns.getReminderHealth(authUser.organizationId, timezone);
  }
}

