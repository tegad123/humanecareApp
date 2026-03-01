"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  AlertCircle,
  ExternalLink,
  Download,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  Spinner,
  Badge,
  Button,
} from "@/components/ui";
import {
  fetchSubscription,
  fetchInvoices,
  fetchPaymentMethods,
  createPortalSession,
  createCheckoutSession,
  cancelSubscription as apiCancelSubscription,
  resumeSubscription as apiResumeSubscription,
  type SubscriptionInfo,
  type Invoice,
  type PaymentMethod,
} from "@/lib/api/billing";

/* ── Helpers ── */

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/* ── Page ── */

export default function BillingPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null,
  );
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const loadBillingData = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      const [subData, invData, pmData] = await Promise.all([
        fetchSubscription(token),
        fetchInvoices(token),
        fetchPaymentMethods(token),
      ]);
      setSubscription(subData);
      setInvoices(invData);
      setPaymentMethods(pmData);
    } catch (err: any) {
      setError(err.message || "Failed to load billing information");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const isPaid =
    subscription?.planTier !== "starter" && subscription?.planTier != null;

  async function handleSubscribe() {
    setCheckoutLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { url } = await createCheckoutSession(token);
      if (!url) {
        throw new Error("Checkout session URL is unavailable");
      }
      window.location.assign(url);
    } catch (err: any) {
      setError(err.message || "Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { url } = await createPortalSession(token);
      if (!url) {
        throw new Error("Billing portal URL is unavailable");
      }
      window.location.assign(url);
    } catch (err: any) {
      setError(err.message || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (cancelLoading) return;
    setCancelLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await apiCancelSubscription(token);
      await loadBillingData();
      setShowCancelConfirm(false);
    } catch (err: any) {
      setError(err.message || "Failed to cancel subscription");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleResumeSubscription() {
    setResumeLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await apiResumeSubscription(token);
      await loadBillingData();
    } catch (err: any) {
      setError(err.message || "Failed to resume subscription");
    } finally {
      setResumeLoading(false);
    }
  }

  const isCanceling = subscription?.subscription?.cancelAtPeriodEnd === true;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
        <p className="text-sm text-slate-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your subscription, payment methods, and invoices.
        </p>
      </div>

      {/* Success / Canceled banners */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">
            Your subscription has been activated successfully.
          </p>
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            Checkout was canceled. No changes were made.
          </p>
        </div>
      )}
      {isCanceling && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              Your plan will downgrade to Free
              {subscription?.subscription?.cancelAt
                ? ` on ${formatDate(subscription.subscription.cancelAt)}`
                : " at the end of your billing period"}
              . You can resume your subscription before then.
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleResumeSubscription}
            loading={resumeLoading}
            className="shrink-0 ml-4"
          >
            Resume
          </Button>
        </div>
      )}

      {/* Inline error (non-fatal) */}
      {error && subscription && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* ── Plan Comparison ── */}
      <div data-tour="plan-comparison">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Your Plan
              </h2>
              {subscription?.subscription && (
                <p className="text-xs text-slate-400">
                  {subscription.subscription.cancelAtPeriodEnd
                    ? `Cancels${subscription.subscription.cancelAt ? ` on ${formatDate(subscription.subscription.cancelAt)}` : " at end of period"}`
                    : `Started ${formatDate(subscription.subscription.startDate)}`}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Free Plan */}
              <div
                className={`rounded-lg border p-5 ${
                  !isPaid
                    ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-900">Free</p>
                  {!isPaid && <Badge variant="info">Current</Badge>}
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-4">$0</p>
                <ul className="space-y-2 mb-5">
                  <li className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Up to 3 clinicians
                  </li>
                  <li className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Basic compliance tracking
                  </li>
                  <li className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Document management
                  </li>
                </ul>
                {!isPaid ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled
                    className="w-full"
                  >
                    Current Plan
                  </Button>
                ) : isCanceling ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled
                    className="w-full"
                  >
                    Downgrade Pending
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    Downgrade to Free
                  </Button>
                )}
              </div>

              {/* Paid Plan */}
              <div
                className={`rounded-lg border p-5 ${
                  isPaid
                    ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-900">Credentis</p>
                  {isPaid && <Badge variant="success">Active</Badge>}
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-4">
                  $499
                  <span className="text-sm font-normal text-slate-500">
                    /mo
                  </span>
                </p>
                <ul className="space-y-2 mb-5">
                  <li className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Unlimited clinicians
                  </li>
                  <li className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Full compliance suite
                  </li>
                  <li className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Priority support
                  </li>
                </ul>
                {isPaid ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={handleManageBilling}
                    loading={portalLoading}
                  >
                    Manage Subscription
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full"
                    loading={checkoutLoading}
                    onClick={handleSubscribe}
                  >
                    Subscribe
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Payment Methods ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Payment Methods
            </h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleManageBilling}
              loading={portalLoading}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Manage
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No payment methods on file. Click Manage to add a card.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {paymentMethods.map((pm) => (
                <li
                  key={pm.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 capitalize">
                        {pm.brand || "Card"} ending in {pm.last4 || "****"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Expires {pm.expMonth}/{pm.expYear}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Invoice History ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Invoice History
            </h2>
            {invoices.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleManageBilling}
                loading={portalLoading}
              >
                View All
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No invoices yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-2.5 font-medium">Invoice</th>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {inv.number || inv.id.slice(0, 12)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatDate(inv.created)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatCurrency(inv.amountPaid, inv.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            inv.status === "paid"
                              ? "success"
                              : inv.status === "open"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {inv.invoicePdf && (
                          <a
                            href={inv.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cancel Confirmation Dialog ── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Cancel Subscription?
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Are you sure you want to downgrade to the Free plan? At the end of
              your current billing period:
            </p>
            <ul className="text-sm text-slate-600 mb-6 space-y-1 ml-4 list-disc">
              <li>Clinician limit drops to 3</li>
              <li>Full compliance suite will be unavailable</li>
              <li>Priority support will no longer be available</li>
            </ul>
            <div className="flex gap-3 justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelLoading}
              >
                Keep Subscription
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleCancelSubscription}
                loading={cancelLoading}
                disabled={cancelLoading}
              >
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
