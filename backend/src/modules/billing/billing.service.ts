import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import Stripe from 'stripe';

type PlanTier = 'starter' | 'growth' | 'pro';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;
  private readonly frontendUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    } else {
      this.logger.warn('STRIPE_SECRET_KEY is not configured — billing endpoints will be unavailable');
      this.stripe = null;
    }

    this.frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    )
      .split(',')[0]
      .trim();
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }
    return this.stripe;
  }

  /* ── Customer Management ── */

  private async getOrCreateCustomer(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    if (org.stripeCustomerId) return org.stripeCustomerId;

    const customer = await this.getStripe().customers.create({
      name: org.name,
      email: org.billingEmail ?? undefined,
      metadata: { organizationId: org.id },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  /* ── Subscription Info ── */

  async getSubscription(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const result: {
      planTier: PlanTier;
      stripeSubscriptionId: string | null;
      billingEmail: string | null;
      subscription: {
        id: string;
        status: string;
        startDate: number;
        cancelAt: number | null;
        cancelAtPeriodEnd: boolean;
        billingCycleAnchor: number;
        items: {
          priceId: string;
          productId: string | null;
          unitAmount: number | null;
          currency: string;
          interval: string | null;
        }[];
      } | null;
    } = {
      planTier: org.planTier,
      stripeSubscriptionId: org.stripeSubscriptionId,
      billingEmail: org.billingEmail,
      subscription: null,
    };

    if (org.stripeSubscriptionId) {
      try {
        const sub = await this.getStripe().subscriptions.retrieve(
          org.stripeSubscriptionId,
        );
        result.subscription = {
          id: sub.id,
          status: sub.status,
          startDate: sub.start_date,
          cancelAt: sub.cancel_at,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          billingCycleAnchor: sub.billing_cycle_anchor,
          items: sub.items.data.map((item) => ({
            priceId: item.price.id,
            productId:
              typeof item.price.product === 'string'
                ? item.price.product
                : null,
            unitAmount: item.price.unit_amount,
            currency: item.price.currency,
            interval: item.price.recurring?.interval ?? null,
          })),
        };
      } catch (err) {
        this.logger.warn(
          `Failed to fetch Stripe subscription ${org.stripeSubscriptionId}`,
          err,
        );
      }
    }

    return result;
  }

  /* ── Checkout Session ── */

  async createCheckoutSession(
    organizationId: string,
    userEmail: string,
  ): Promise<{ url: string }> {
    const priceId = this.config.get<string>('STRIPE_PRICE_ID');
    if (!priceId) {
      throw new InternalServerErrorException('STRIPE_PRICE_ID is not configured');
    }

    const customerId = await this.getOrCreateCustomer(organizationId);

    const session = await this.getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.frontendUrl}/dashboard/billing?success=true`,
      cancel_url: `${this.frontendUrl}/dashboard/billing?canceled=true`,
      subscription_data: {
        metadata: { organizationId },
      },
      metadata: { organizationId },
    });

    if (!session.url) {
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }

    return { url: session.url };
  }

  /* ── Customer Portal Session ── */

  async createPortalSession(
    organizationId: string,
  ): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(organizationId);

    const session = await this.getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.frontendUrl}/dashboard/billing`,
    });

    return { url: session.url };
  }

  /* ── Invoices ── */

  async listInvoices(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.stripeCustomerId) return [];

    const invoices = await this.getStripe().invoices.list({
      customer: org.stripeCustomerId,
      limit: 24,
    });

    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amountDue: inv.amount_due,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }));
  }

  /* ── Payment Methods ── */

  async listPaymentMethods(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.stripeCustomerId) return [];

    const methods = await this.getStripe().paymentMethods.list({
      customer: org.stripeCustomerId,
      type: 'card',
    });

    return methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    }));
  }

  /* ── Webhook Handler ── */

  async handleWebhookEvent(payload: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new BadRequestException('Webhook not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.getStripe().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Processing webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.mode === 'subscription' &&
          session.subscription &&
          session.metadata?.organizationId
        ) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;

          await this.prisma.organization.update({
            where: { id: session.metadata.organizationId },
            data: {
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId:
                typeof session.customer === 'string'
                  ? session.customer
                  : (session.customer?.id ?? undefined),
              planTier: 'pro',
            },
          });

          this.logger.log(
            `Organization ${session.metadata.organizationId} subscribed (sub: ${subscriptionId})`,
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Subscription still active — keep pro tier
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.organizationId;
        if (orgId) {
          await this.prisma.organization.update({
            where: { id: orgId },
            data: {
              planTier: 'starter',
              stripeSubscriptionId: null,
            },
          });
          this.logger.log(
            `Organization ${orgId} subscription canceled, downgraded to starter`,
          );
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        this.logger.log(
          `Invoice ${invoice.id} paid for customer ${invoice.customer}`,
        );
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }

    return { received: true };
  }
}
