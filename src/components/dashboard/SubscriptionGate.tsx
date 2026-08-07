import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/hooks/useSubscription";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { ELITE_PRICE_ID } from "@/lib/stripe";


/**
 * Locks the dashboard once an account is no longer entitled to access.
 *
 * Entitlement rules:
 *  - An active (or canceled-but-still-inside-the-paid-period) subscription => access.
 *  - A comped / trial account (trial_unlimited, or a trial that hasn't expired) => access.
 *  - Admins => always access.
 * Anything else (expired trial, or a subscription whose paid period has ended) => paywall.
 */
export function SubscriptionGate({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { subscription, isActive, loading: subLoading } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [profile, setProfile] = useState<{
    billing_status: string;
    trial_unlimited: boolean;
    trial_ends_at: string | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("billing_status, trial_unlimited, trial_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile((data as never) ?? null);
      setProfileLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (isAdmin) return <>{children}</>;
  if (subLoading || profileLoading || !profile) return <>{children}</>;
  if (isActive) return <>{children}</>;

  const trialOk =
    profile.trial_unlimited ||
    (profile.billing_status === "trial" &&
      (!profile.trial_ends_at || new Date(profile.trial_ends_at).getTime() > Date.now()));

  const subscriptionLapsed = Boolean(subscription) && !isActive;
  const locked = subscriptionLapsed || profile.billing_status === "trial_expired" || !trialOk;

  if (!locked) return <>{children}</>;

  async function reactivate() {
    if (!user) return;
    try {
      await openCheckout({
        priceId: ELITE_PRICE_ID,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/dashboard?checkout=success`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open checkout.");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
        <Lock className="h-5 w-5 text-gold-foreground" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
        Your plan has ended
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your receptionist is paused and your dashboard is locked, but nothing has been deleted —
        your settings, FAQs, threads and leads are all still here. Restart your plan to switch
        everything back on instantly.
      </p>
      <button
        onClick={reactivate}
        disabled={checkoutLoading}
        className="mt-6 rounded-xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--gold-foreground)] hover:opacity-90 disabled:opacity-60"
      >
        {checkoutLoading ? "Opening…" : "Restart Elite — $197/mo"}
      </button>
      <p className="mt-4 text-xs text-muted-foreground">
        Need a hand? Email{" "}
        <a href="mailto:hello@askjanice.net" className="font-medium text-gold hover:underline">
          hello@askjanice.net
        </a>
      </p>
    </div>
  );
}
