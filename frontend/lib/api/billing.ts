import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface SubscriptionInfo {
  planTier: 'starter' | 'growth' | 'pro';
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
}

export interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  periodStart: number;
  periodEnd: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

export interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

/* ── API Calls ── */

export async function fetchSubscription(token: string | null) {
  return clientApiFetch<SubscriptionInfo>('/billing/subscription', token);
}

export async function createCheckoutSession(token: string | null) {
  return clientApiFetch<{ url: string }>('/billing/checkout-session', token, {
    method: 'POST',
  });
}

export async function createPortalSession(token: string | null) {
  return clientApiFetch<{ url: string }>('/billing/portal-session', token, {
    method: 'POST',
  });
}

export async function fetchInvoices(token: string | null) {
  return clientApiFetch<Invoice[]>('/billing/invoices', token);
}

export async function fetchPaymentMethods(token: string | null) {
  return clientApiFetch<PaymentMethod[]>('/billing/payment-methods', token);
}
