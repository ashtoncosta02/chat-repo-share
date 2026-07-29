import { useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { ELITE_PRICE_ID, getPaddleEnvironment } from "@/lib/paddle";
import { createBillingPortalUrl } from "@/utils/payments.functions";

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment failed — retrying",
  paused: "Paused",
  canceled: "Canceled",
};

export function BillingSection() {
  const { user } = useAuth();
  const { subscription, isActive, cancelAtPeriodEnd, loading, refetch } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [portalBusy, setPortalBusy] = useState(false);

  async function startPlan() {
    if (!user) return;
    try {
      await openCheckout({
        priceId: ELITE_PRICE_ID,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/dashboard/account?checkout=success`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open checkout.");
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    try {
      const urls = await createBillingPortalUrl({
        data: { environment: getPaddleEnvironment() },
      });
      window.open(urls.overviewUrl, "_blank", "noopener");
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the billing portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <section id="billing" className="mt-6 scroll-mt-20 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold text-foreground">Subscription &amp; billing</h2>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your plan…</p>
      ) : (
        <>
          <dl className="mt-4 text-sm">
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground">Current plan</dt>
              <dd className="font-medium text-foreground">
                {subscription ? "Elite — $197/mo" : "No paid plan"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground">
                {subscription ? STATUS_LABEL[subscription.status] ?? subscription.status : "—"}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">
                {cancelAtPeriodEnd ? "Access until" : "Next charge"}
              </dt>
              <dd className="font-medium text-foreground">
                {fmtDate(subscription?.current_period_end ?? null)}
              </dd>
            </div>
          </dl>

          {subscription?.status === "past_due" && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              We couldn't take your last payment. Update your card in the billing portal — your
              receptionist keeps working while we retry.
            </div>
          )}

          {cancelAtPeriodEnd && isActive && (
            <div className="mt-4 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
              Your plan is set to end on {fmtDate(subscription?.current_period_end ?? null)}. Your
              receptionist stays live until then — nothing is lost if you change your mind.
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!isActive ? (
              <button
                onClick={startPlan}
                disabled={checkoutLoading}
                className="rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-medium text-[var(--gold-foreground)] hover:opacity-90 disabled:opacity-50"
              >
                {checkoutLoading ? "Opening…" : "Start Elite — $197/mo"}
              </button>
            ) : (
              <button
                onClick={openPortal}
                disabled={portalBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {portalBusy ? "Opening…" : "Manage billing"}
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Payments are handled by Paddle, our secure payment partner. Cancel anytime from the
            billing portal — you keep full access until the end of the period you've paid for.
          </p>
        </>
      )}
    </section>
  );
}
