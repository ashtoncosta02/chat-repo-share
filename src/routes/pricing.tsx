import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bot,
  Phone,
  UserPlus,
  FileText,
  BarChart3,
  MessageSquare,
  MessageCircle,
  PhoneForwarded,
  CalendarCheck,
  PhoneCall,
  Rocket,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { ELITE_PRICE_ID } from "@/lib/stripe";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Ask Janice" },
      {
        name: "description",
        content:
          "Ask Janice Elite Plan: $49/mo for unlimited calls, 24/7 AI receptionist, lead capture, booking, and setup included.",
      },
      { property: "og:title", content: "Pricing — Ask Janice" },
      {
        property: "og:description",
        content:
          "Ask Janice Elite Plan: $49/mo for unlimited calls, 24/7 AI receptionist, lead capture, booking, and setup included.",
      },
      { property: "og:url", content: "https://askjanice.net/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://askjanice.net/pricing" }],
  }),
  component: PricingPage,
});

const features = [
  { icon: Bot, label: "1 AI voice agent trained on your business" },
  { icon: Phone, label: "Unlimited calls, 24/7" },
  { icon: UserPlus, label: "Lead capture — name, phone & email saved automatically" },
  { icon: FileText, label: "Full conversation transcripts" },
  { icon: BarChart3, label: "Analytics dashboard — call volume, peak hours, leads" },
  { icon: MessageSquare, label: "SMS follow-up after every call (optional)" },
  { icon: MessageCircle, label: "Live chat widget for your website" },
  { icon: PhoneForwarded, label: "Instant human transfer for emergencies" },
  { icon: CalendarCheck, label: "Google Calendar booking integration" },
  { icon: PhoneCall, label: "One-click callback from your leads dashboard" },
  { icon: Rocket, label: "Full setup included — ready in minutes" },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <PricingCard />
        <FeatureList />
        <ExtraNote />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight">
          Ask <span className="text-gold">Janice</span>
        </Link>
        <Link
          to="/auth"
          className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}

function PricingCard() {
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
    <section className="rounded-3xl border border-border bg-card p-8 shadow-sm md:p-10">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
          Elite Plan
        </p>
        <p className="mt-4 font-display text-7xl font-bold text-gold">$49</p>
        <p className="mt-2 text-sm text-muted-foreground">per month</p>
        <div className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm text-gold-foreground">
          Unlimited calls · Setup included · No contracts
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-xl bg-[var(--gold)] px-6 py-3.5 text-base font-semibold text-[var(--gold-foreground)] shadow-sm transition hover:opacity-90 sm:w-auto sm:px-10"
        >
          Get started — $49/mo
        </button>
      </div>
      {checkoutElement}


      <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Secure checkout · Cancel anytime · 30-day money back
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Questions? Email{" "}
        <a
          href="mailto:hello@askjanice.net"
          className="font-medium text-gold hover:underline"
        >
          hello@askjanice.net
        </a>
      </p>
    </section>
  );
}

function FeatureList() {
  return (
    <section className="mt-8 rounded-3xl border border-border bg-card p-8 shadow-sm md:p-10">
      <h2 className="font-display text-2xl font-bold tracking-tight">Everything included</h2>
      <ul className="mt-6 space-y-4">
        {features.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-gold-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-base text-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExtraNote() {
  return (
    <section className="mt-6 rounded-3xl border border-dashed border-border bg-secondary/40 p-6 text-center md:p-8">
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Need more agents?</span>{" "}
        Additional agents for multiple locations or departments are available.{" "}
        <a
          href="mailto:hello@askjanice.net"
          className="font-medium text-gold hover:underline"
        >
          Contact us for custom pricing.
        </a>
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ask Janice. All rights reserved. ·{" "}
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
        <Link to="/terms" className="hover:text-foreground">Terms</Link> ·{" "}
        <Link to="/refund-policy" className="hover:text-foreground">Refunds</Link>
      </div>
    </footer>
  );
}
