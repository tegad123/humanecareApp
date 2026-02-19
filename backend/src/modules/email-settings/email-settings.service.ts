import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { UpsertEmailSettingsDto } from './dto/upsert-email-settings.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';

export interface EmailSettingsData {
  subject: string;
  introText: string;
  requiredItemsIntro: string;
  signatureBlock: string;
  legalDisclaimer: string;
}

const DEFAULTS: EmailSettingsData = {
  subject: 'Welcome to {{orgName}} — Complete Your Onboarding',
  introText: 'Welcome to the {{orgName}} team! We are excited to have you on board. Please complete the following onboarding items to get started.',
  requiredItemsIntro: 'Here are the items you need to complete:',
  signatureBlock: 'Best regards,\nThe {{orgName}} Team',
  legalDisclaimer: 'This email was sent as part of the onboarding process. If you believe you received this in error, please contact us.',
};

@Injectable()
export class EmailSettingsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  getDefaults(): EmailSettingsData {
    return { ...DEFAULTS };
  }

  async get(organizationId: string): Promise<EmailSettingsData & { id?: string }> {
    const settings = await this.prisma.orgEmailSettings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      return this.getDefaults();
    }

    return {
      id: settings.id,
      subject: settings.subject || DEFAULTS.subject,
      introText: settings.introText || DEFAULTS.introText,
      requiredItemsIntro: settings.requiredItemsIntro || DEFAULTS.requiredItemsIntro,
      signatureBlock: settings.signatureBlock || DEFAULTS.signatureBlock,
      legalDisclaimer: settings.legalDisclaimer || DEFAULTS.legalDisclaimer,
    };
  }

  async upsert(
    organizationId: string,
    dto: UpsertEmailSettingsDto,
    user: AuthenticatedUser,
  ) {
    const settings = await this.prisma.orgEmailSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        subject: dto.subject,
        introText: dto.introText,
        requiredItemsIntro: dto.requiredItemsIntro,
        signatureBlock: dto.signatureBlock,
        legalDisclaimer: dto.legalDisclaimer,
      },
      update: {
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.introText !== undefined && { introText: dto.introText }),
        ...(dto.requiredItemsIntro !== undefined && { requiredItemsIntro: dto.requiredItemsIntro }),
        ...(dto.signatureBlock !== undefined && { signatureBlock: dto.signatureBlock }),
        ...(dto.legalDisclaimer !== undefined && { legalDisclaimer: dto.legalDisclaimer }),
      },
    });

    await this.auditLogs.log({
      organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'org_email_settings',
      entityId: settings.id,
      action: 'email_settings_updated',
      details: { fields: Object.keys(dto) },
    });

    return settings;
  }
}
