import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Email service with console.log fallback in development.
 * In production, sends via SendGrid.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sendgridApiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly isProduction: boolean;

  constructor(private config: ConfigService) {
    this.sendgridApiKey = this.config.get<string>('SENDGRID_API_KEY');
    this.fromEmail =
      this.config.get<string>('EMAIL_FROM') || 'noreply@humanecare.app';
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Send an email. In dev, logs to console. In prod, uses SendGrid HTTP API.
   */
  async send(payload: EmailPayload): Promise<void> {
    if (!this.isProduction || !this.sendgridApiKey) {
      this.logger.log(`[DEV EMAIL] To: ${payload.to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${payload.subject}`);
      this.logger.log(`[DEV EMAIL] Body: ${payload.text}`);
      return;
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: this.fromEmail },
          subject: payload.subject,
          content: [
            { type: 'text/plain', value: payload.text },
            ...(payload.html
              ? [{ type: 'text/html', value: payload.html }]
              : []),
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `SendGrid error (${response.status}): ${errorBody}`,
        );
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
      'Please log in to your HumaneCare portal to upload the renewed document.',
      '',
      'Thank you,',
      'HumaneCare Team',
    ].join('\n');

    await this.send({
      to: clinicianEmail,
      subject,
      text,
    });
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
      'Please review in the HumaneCare admin dashboard.',
      '',
      '- HumaneCare System',
    ].join('\n');

    await this.send({
      to: adminEmail,
      subject,
      text,
    });
  }
}
