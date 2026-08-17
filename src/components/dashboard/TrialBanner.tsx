import { useEffect, useState } from "react";
import { AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/hooks/useSubscription";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { ELITE_PRICE_ID, getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Slim status bar shown at the top of every dashboard page.
 *  - Stripe trial (card on file): countdown + the date the first charge lands.
 *  - Comped trial (no card): countdown + Upgrade button.
 *  - past_due: red "update payment method" bar.
 * Hidden for admins, unlimited/comped accounts, and fully paid subscriptions.
 */
export function TrialBanner({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const { subscription, isPastDue } = useSubscription();
  const { openCheckout, checkoutElement } = useStripeCheckout();
  const [portalBusy, setPortalBusy] = useState(false);
  const [profile, setProfile] = useState<{
    billing_status: string;
    trial_unlimited: boolean;
    trial_ends_at: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("billing_status, trial_unlimited, trial_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setProfile((data as never) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function openPortal() {
    setPortalBusy(true);
    try {
      const result = await createPortalSession({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/dashboard/account`,
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the billing portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  function upgrade() {
    if (!user) return;
    openCheckout({
      priceId: ELITE_PRICE_ID,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/dashboard?checkout=success`,
    });
  }

  if (isAdmin || !user) return null;

  // Payment failed — highest priority.
  if (isPastDue) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Your last payment failed. Update your card to keep your receptionist running.</span>
        <button
          onClick={openPortal}
          disabled={portalBusy}
          className="rounded-lg bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
        >
          {portalBusy ? "Opening…" : "Update payment method"}
        </button>
      </div>
    );
  }

  // Stripe free trial with a card on file.
  if (subscription?.status === "trialing") {
    const left = daysLeft(subscription.current_period_end);
    const urgent = left !== null && left <= 2;
    return (
      <div
        className={`flex flex-wrap items-center justify-center gap-2 border-b px-4 py-2 text-sm ${
          urgent
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-border bg-muted/60 text-foreground"
        }`}
      >
        <Clock className="h-4 w-4" />
        <span>
          {left === 0
            ? "Your free trial ends today"
            : `${left} day${left === 1 ? "" : "s"} left in your free trial`}
          {subscription.current_period_end
            ? ` — you'll be charged $97/mo on ${fmtDate(subscription.current_period_end)}.`
            : "."}
        </span>
        <button
          onClick={openPortal}
          disabled={portalBusy}
          className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          {portalBusy ? "Opening…" : "Manage billing"}
        </button>
      </div>
    );
  }

  if (!profile || profile.trial_unlimited || subscription) return null;

  // Comped / invited trial without a card on file.
  if (profile.billing_status === "trial" && profile.trial_ends_at) {
    const left = daysLeft(profile.trial_ends_at);
    if (left === null) return null;
    const urgent = left <= 2;
    return (
      <>
        <div
          className={`flex flex-wrap items-center justify-center gap-2 border-b px-4 py-2 text-sm ${
            urgent
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-border bg-muted/60 text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>
            {left === 0
              ? "Your free trial ends today"
              : `${left} day${left === 1 ? "" : "s"} left in your free trial`}
            {` (ends ${fmtDate(profile.trial_ends_at)}).`}
          </span>
          <button
            onClick={upgrade}
            className="rounded-lg bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-[var(--gold-foreground)] hover:opacity-90"
          >
            Upgrade to Elite — $97/mo
          </button>
        </div>
        {checkoutElement}
      </>
    );
  }

  return null;
}
