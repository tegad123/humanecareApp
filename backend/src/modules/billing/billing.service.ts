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
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

type PlanTier = 'starter' | 'growth' | 'pro';
type BillingActor = { id: string; role: string };

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;
  private readonly frontendUrl: string;
  private readonly processedEvents = new Set<string>();
  private readonly defaultGracePeriodDays = 45;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
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
      organizationId: string;
      planTier: PlanTier;
      accessMode: 'active' | 'read_only' | 'suspended';
      gracePeriodEndsAt: string | null;
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
      organizationId,
      planTier: org.planTier,
      accessMode: 'active',
      gracePeriodEndsAt: null,
      stripeSubscriptionId: org.stripeSubscriptionId,
      billingEmail: org.billingEmail,
      subscription: null,
    };

    try {
      const modeRows = await this.prisma.$queryRaw<
        Array<{ access_mode: 'active' | 'read_only' | 'suspended'; grace_period_ends_at: Date | null }>
      >`
        SELECT access_mode, grace_period_ends_at
        FROM organizations
        WHERE id = ${organizationId}
        LIMIT 1
      `;
      if (modeRows[0]) {
        result.accessMode = modeRows[0].access_mode;
        result.gracePeriodEndsAt = modeRows[0].grace_period_ends_at
          ? modeRows[0].grace_period_ends_at.toISOString()
          : null;
      }
    } catch {
      // Backward-compatible default before Phase 3 migration is applied.
    }

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
    actor?: BillingActor,
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

    await this.auditLogs.log({
      organizationId,
      actorUserId: actor?.id,
      actorRole: actor?.role as any,
      entityType: 'billing',
      entityId: organizationId,
      action: 'billing_checkout_session_created',
      details: {
        mode: session.mode,
        sessionId: session.id,
        customerId,
        email: userEmail,
      },
    });

    return { url: session.url };
  }

  /* ── Customer Portal Session ── */

  async createPortalSession(
    organizationId: string,
    actor?: BillingActor,
  ): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(organizationId);

    const session = await this.getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.frontendUrl}/dashboard/billing`,
    });

    await this.auditLogs.log({
      organizationId,
      actorUserId: actor?.id,
      actorRole: actor?.role as any,
      entityType: 'billing',
      entityId: organizationId,
      action: 'billing_portal_session_created',
      details: {
        customerId,
      },
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

  /* ── Cancel / Resume Subscription ── */

  async cancelSubscription(organizationId: string, actor?: BillingActor) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription to cancel');
    }

    try {
      const sub = await this.getStripe().subscriptions.update(
        org.stripeSubscriptionId,
        { cancel_at_period_end: true },
      );

      this.logger.log(
        `Organization ${organizationId} scheduled subscription cancellation at period end`,
      );

      await this.auditLogs.log({
        organizationId,
        actorUserId: actor?.id,
        actorRole: actor?.role as any,
        entityType: 'billing',
        entityId: organizationId,
        action: 'billing_subscription_cancel_scheduled',
        details: {
          subscriptionId: org.stripeSubscriptionId,
          cancelAt: sub.cancel_at,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });

      return {
        cancelAt: sub.cancel_at,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    } catch (err: any) {
      this.logger.error(`Failed to cancel subscription for org ${organizationId}`, err);
      if (err.type === 'StripeInvalidRequestError') {
        throw new BadRequestException('Subscription not found or already canceled in Stripe');
      }
      throw new InternalServerErrorException('Failed to cancel subscription. Please try again.');
    }
  }

  async resumeSubscription(organizationId: string, actor?: BillingActor) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.stripeSubscriptionId) {
      throw new BadRequestException('No subscription to resume');
    }

    try {
      const sub = await this.getStripe().subscriptions.update(
        org.stripeSubscriptionId,
        { cancel_at_period_end: false },
      );

      this.logger.log(
        `Organization ${organizationId} resumed subscription (cancellation undone)`,
      );

      await this.auditLogs.log({
        organizationId,
        actorUserId: actor?.id,
        actorRole: actor?.role as any,
        entityType: 'billing',
        entityId: organizationId,
        action: 'billing_subscription_resume',
        details: {
          subscriptionId: org.stripeSubscriptionId,
          cancelAt: sub.cancel_at,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });

      return {
        cancelAt: sub.cancel_at,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    } catch (err: any) {
      this.logger.error(`Failed to resume subscription for org ${organizationId}`, err);
      if (err.type === 'StripeInvalidRequestError') {
        throw new BadRequestException('Subscription not found or already canceled in Stripe');
      }
      throw new InternalServerErrorException('Failed to resume subscription. Please try again.');
    }
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

    // Idempotency: skip already-processed events
    if (this.processedEvents.has(event.id)) {
      this.logger.log(`Skipping duplicate webhook event: ${event.id}`);
      return { received: true };
    }
    this.processedEvents.add(event.id);

    // Prevent unbounded growth (keep last 1000 events)
    if (this.processedEvents.size > 1000) {
      const first = this.processedEvents.values().next().value;
      if (first) this.processedEvents.delete(first);
    }

    this.logger.log(`Processing webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Support both API checkout (metadata) and Payment Links (client_reference_id)
        const orgId =
          session.metadata?.organizationId || session.client_reference_id;

        if (session.mode === 'subscription' && session.subscription && orgId) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;

          try {
            await this.prisma.organization.update({
              where: { id: orgId },
              data: {
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId:
                  typeof session.customer === 'string'
                    ? session.customer
                    : (session.customer?.id ?? undefined),
                planTier: 'pro',
              },
            });
            await this.prisma.$executeRaw`
              UPDATE organizations
              SET
                access_mode = 'active'::"OrgAccessMode",
                grace_period_ends_at = NULL,
                updated_at = NOW()
              WHERE id = ${orgId}
            `;
          } catch (err) {
            this.logger.error(`Failed to process checkout for org ${orgId}`, err);
            break;
          }

          // Store orgId on the subscription metadata for cancel events
          try {
            await this.getStripe().subscriptions.update(subscriptionId, {
              metadata: { organizationId: orgId },
            });
          } catch {
            this.logger.warn(
              `Failed to set metadata on subscription ${subscriptionId}`,
            );
          }

          this.logger.log(
            `Organization ${orgId} subscribed (sub: ${subscriptionId})`,
          );
          await this.auditLogs.log({
            organizationId: orgId,
            entityType: 'billing',
            entityId: orgId,
            action: 'billing_subscription_activated',
            details: {
              eventId: event.id,
              subscriptionId,
              customerId:
                typeof session.customer === 'string'
                  ? session.customer
                  : (session.customer?.id ?? null),
              source: 'stripe_webhook',
            },
          });
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
          try {
            await this.prisma.organization.update({
              where: { id: orgId },
              data: {
                planTier: 'starter',
                stripeSubscriptionId: null,
              },
            });
            const graceEndsAt = new Date(
              Date.now() + this.defaultGracePeriodDays * 24 * 60 * 60 * 1000,
            );
            await this.prisma.$executeRaw`
              UPDATE organizations
              SET
                access_mode = 'read_only'::"OrgAccessMode",
                grace_period_ends_at = ${graceEndsAt},
                updated_at = NOW()
              WHERE id = ${orgId}
            `;
            this.logger.log(
              `Organization ${orgId} subscription canceled, downgraded to starter, read-only grace until ${graceEndsAt.toISOString()}`,
            );
            await this.auditLogs.log({
              organizationId: orgId,
              entityType: 'billing',
              entityId: orgId,
              action: 'billing_subscription_canceled',
              details: {
                eventId: event.id,
                subscriptionId: sub.id,
                source: 'stripe_webhook',
                downgradedPlanTier: 'starter',
                accessMode: 'read_only',
                gracePeriodDays: this.defaultGracePeriodDays,
                gracePeriodEndsAt: graceEndsAt.toISOString(),
              },
            });
          } catch (err) {
            this.logger.error(`Failed to downgrade org ${orgId} after subscription deletion`, err);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        this.logger.log(
          `Invoice ${invoice.id} paid for customer ${invoice.customer}`,
        );
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : null;
        if (customerId) {
          await this.prisma.$executeRaw`
            UPDATE organizations
            SET
              access_mode = 'active'::"OrgAccessMode",
              grace_period_ends_at = NULL,
              updated_at = NOW()
            WHERE stripe_customer_id = ${customerId}
          `;
        }
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }

    return { received: true };
  }
}
