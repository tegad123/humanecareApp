import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Email service powered by Resend.
 * In development without an API key, logs to console.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail =
      this.config.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
  }

  /**
   * Send an email. Falls back to console.log when no Resend API key is set.
   */
  async send(payload: EmailPayload): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[DEV EMAIL] To: ${payload.to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${payload.subject}`);
      this.logger.log(`[DEV EMAIL] Body: ${payload.text}`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      if (error) {
        this.logger.error(`Resend error: ${JSON.stringify(error)}`);
      } else {
        this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${payload.to}: ${error.message}`);
    }
  }

  /**
   * Send an expiration reminder email.
   */
  async sendExpirationReminder(
    clinicianEmail: string,
    clinicianName: string,
    itemLabel: string,
    daysUntilExpiry: number,
    expiresAt: Date,
  ): Promise<void> {
    const urgency =
      daysUntilExpiry <= 0
        ? 'EXPIRED'
        : daysUntilExpiry <= 7
          ? 'URGENT'
          : 'Upcoming';

    const subject =
      daysUntilExpiry <= 0
        ? `[ACTION REQUIRED] ${itemLabel} has expired`
        : `[${urgency}] ${itemLabel} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`;

    const text = [
      `Hi ${clinicianName},`,
      '',
      daysUntilExpiry <= 0
        ? `Your ${itemLabel} has expired as of ${expiresAt.toLocaleDateString()}.`
        : `Your ${itemLabel} will expire on ${expiresAt.toLocaleDateString()} (${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} from now).`,
      '',
      'Please log in to your Credentis portal to upload the renewed document.',
      '',
      'Thank you,',
      'Credentis Team',
    ].join('\n');

    await this.send({
      to: clinicianEmail,
      subject,
      text,
    });
  }

  /**
   * Send a clinician invite email with a link to accept and sign up.
   * Supports customizable email settings and required items list.
   */
  async sendClinicianInvite(
    clinicianEmail: string,
    clinicianName: string,
    organizationName: string,
    inviteUrl: string,
    options?: {
      emailSettings?: {
        subject?: string;
        introText?: string;
        requiredItemsIntro?: string;
        signatureBlock?: string;
        legalDisclaimer?: string;
      };
      requiredItems?: string[];
    },
  ): Promise<void> {
    const settings = options?.emailSettings;
    const requiredItems = options?.requiredItems;

    // Resolve subject with template variables
    const rawSubject = settings?.subject || `You've been invited to join {{orgName}} on Credentis`;
    const subject = rawSubject.replace(/\{\{orgName\}\}/g, organizationName);

    // Resolve intro text
    const rawIntro = settings?.introText || `{{orgName}} has invited you to complete your onboarding on Credentis.`;
    const introText = rawIntro.replace(/\{\{orgName\}\}/g, organizationName);

    // Resolve signature block
    const rawSignature = settings?.signatureBlock || `Thank you,\nCredentis Team`;
    const signatureBlock = rawSignature.replace(/\{\{orgName\}\}/g, organizationName);

    // Required items section
    const requiredItemsIntro = settings?.requiredItemsIntro || 'Here are the items you need to complete:';
    let requiredItemsHtml = '';
    let requiredItemsText = '';
    if (requiredItems && requiredItems.length > 0) {
      requiredItemsText = `\n${requiredItemsIntro}\n${requiredItems.map(i => `  - ${i}`).join('\n')}\n`;
      requiredItemsHtml = `
        <p style="margin-top: 16px; font-weight: 600;">${requiredItemsIntro}</p>
        <ul style="color: #334155; padding-left: 20px;">
          ${requiredItems.map(i => `<li style="margin-bottom: 4px;">${i}</li>`).join('')}
        </ul>
      `;
    }

    // Legal disclaimer
    const legalDisclaimer = settings?.legalDisclaimer || '';

    const text = [
      `Hi ${clinicianName},`,
      '',
      introText,
      requiredItemsText,
      `Click the link below to get started:`,
      inviteUrl,
      '',
      'This invite link will expire in 7 days.',
      '',
      signatureBlock,
      ...(legalDisclaimer ? ['', '---', legalDisclaimer] : []),
    ].join('\n');

    const signatureHtml = signatureBlock.replace(/\n/g, '<br/>');
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Welcome to ${organizationName}</h2>
        <p>Hi ${clinicianName},</p>
        <p>${introText}</p>
        ${requiredItemsHtml}
        <p style="margin: 24px 0;">
          <a href="${inviteUrl}"
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Accept Invite &amp; Get Started
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">This invite link will expire in 7 days.</p>
        <p style="color: #64748b; font-size: 14px;">${signatureHtml}</p>
        ${legalDisclaimer ? `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"/><p style="color: #94a3b8; font-size: 12px;">${legalDisclaimer}</p>` : ''}
      </div>
    `;

    await this.send({ to: clinicianEmail, subject, text, html });
  }

  /**
   * Send an admin notification about expired items.
   */
  async sendAdminExpirationAlert(
    adminEmail: string,
    clinicianName: string,
    itemLabel: string,
    daysUntilExpiry: number,
  ): Promise<void> {
    const subject =
      daysUntilExpiry <= 0
        ? `[Alert] ${clinicianName}'s ${itemLabel} has expired`
        : `[Notice] ${clinicianName}'s ${itemLabel} expires in ${daysUntilExpiry} days`;

    const text = [
      `Admin notification:`,
      '',
      daysUntilExpiry <= 0
        ? `${clinicianName}'s ${itemLabel} has expired and their status may need attention.`
        : `${clinicianName}'s ${itemLabel} will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}.`,
      '',
      'Please review in the Credentis admin dashboard.',
      '',
      '- Credentis System',
    ].join('\n');

    await this.send({
      to: adminEmail,
      subject,
      text,
    });
  }
}
