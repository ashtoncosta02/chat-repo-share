import { useNavigate } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { ELITE_PRICE_ID } from "@/lib/stripe";
import { Reveal } from "./Reveal";

const included = [
  "1 AI receptionist trained on your business",
  "Unlimited calls, 24/7",
  "Lead capture — name, phone & email saved automatically",
  "Full conversation transcripts",
  "Analytics dashboard — call volume, peak hours, leads",
  "SMS follow-up after every call (optional)",
  "Live chat bot for your website",
  "Instant human transfer for emergencies",
  "Google Calendar & Outlook booking",
  "One-click callback from your leads dashboard",
];

export function PricingSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openCheckout, checkoutElement } = useStripeCheckout();

  function handleStart() {
    if (!user) {
      void navigate({ to: "/auth", search: { mode: "signup", next: "/dashboard/account" } as never });
      return;
    }
    openCheckout({
      priceId: ELITE_PRICE_ID,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/dashboard?checkout=success`,
    });
  }

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Pricing</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
          One simple plan
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Everything included. No per-minute fees, no setup fees, no contracts.
        </p>
      </Reveal>

      <Reveal delay={120} className="mt-12">
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-border bg-card p-8 shadow-xl md:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--gold)] opacity-[0.12] blur-3xl"
          />
          <div className="relative text-center">
            <span className="inline-flex rounded-full bg-[var(--gold)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-foreground)]">
              Most popular
            </span>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              Elite Plan
            </p>
            <p className="mt-3 font-display text-7xl font-bold text-gold">$97</p>
            <p className="mt-2 text-sm text-muted-foreground">per month</p>
            <div className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm text-gold-foreground">
              Unlimited calls · No contracts
            </div>
          </div>

          <ul className="relative mt-9 grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="relative mt-9 text-center">
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-full bg-[var(--gold)] px-8 py-4 text-base font-semibold text-[var(--gold-foreground)] shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:opacity-95 sm:w-auto sm:px-12"
            >
              Get started — $97/mo
            </button>
          </div>
          {checkoutElement}

          <p className="relative mt-5 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Secure checkout · Cancel anytime · 30-day money back
          </p>
          <p className="relative mt-2 text-center text-sm text-muted-foreground">
            Questions? Email{" "}
            <a href="mailto:hello@askjanice.net" className="font-medium text-gold hover:underline">
              hello@askjanice.net
            </a>{" "}
            or call{" "}
            <a href="tel:+12899071201" className="font-medium text-gold hover:underline">
              (289) 907-1201
            </a>
          </p>
        </div>
      </Reveal>

      <Reveal delay={200} className="mt-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-secondary/40 p-6 text-center md:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Need more receptionists?</span>{" "}
            Additional receptionists for multiple locations or departments are available.{" "}
            <a
              href="mailto:hello@askjanice.net"
              className="font-medium text-gold hover:underline"
            >
              Contact us for custom pricing.
            </a>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
