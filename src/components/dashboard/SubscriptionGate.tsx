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
  const { openCheckout, checkoutElement } = useStripeCheckout();
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

  // Brand-new self-signup: card on file required before the 7-day trial starts.
  if (
    !subscription &&
    !profile.trial_unlimited &&
    profile.billing_status === "pending_trial"
  ) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
            <Sparkles className="h-5 w-5 text-gold-foreground" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
            Start your 7-day free trial
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Add a card to switch your receptionist on. You won't be charged today — your first
            payment of $97/mo happens 7 days from now, and you can cancel any time before then.
          </p>
        </div>
        <div className="mt-8">
          <StripeEmbeddedCheckout
            priceId={ELITE_PRICE_ID}
            customerEmail={user?.email ?? undefined}
            userId={user?.id}
            trialDays={7}
            returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/dashboard?checkout=success`}
          />
        </div>
      </div>
    );
  }

  const trialOk =
    profile.trial_unlimited ||
    (profile.billing_status === "trial" &&
      (!profile.trial_ends_at || new Date(profile.trial_ends_at).getTime() > Date.now()));

  const subscriptionLapsed = Boolean(subscription) && !isActive;
  const locked = subscriptionLapsed || profile.billing_status === "trial_expired" || !trialOk;

  if (!locked) return <>{children}</>;


  function reactivate() {
    if (!user) return;
    openCheckout({
      priceId: ELITE_PRICE_ID,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/dashboard?checkout=success`,
    });
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
        className="mt-6 rounded-xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--gold-foreground)] hover:opacity-90"
      >
        Restart Elite — $97/mo
      </button>
      {checkoutElement}

      <p className="mt-4 text-xs text-muted-foreground">
        Need a hand? Email{" "}
        <a href="mailto:hello@askjanice.net" className="font-medium text-gold hover:underline">
          hello@askjanice.net
        </a>
      </p>
    </div>
  );
}
