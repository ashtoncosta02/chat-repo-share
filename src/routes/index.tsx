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
  Sparkles,
  PhoneForwarded,
  CalendarCheck,
  PhoneCall,
  Rocket,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agent Factory — AI Voice Agents for Your Business" },
      {
        name: "description",
        content:
          "A custom AI voice agent trained on your business. Answers calls, captures leads, books appointments, and follows up automatically. 24/7.",
      },
      { property: "og:title", content: "Agent Factory — AI Voice Agents for Your Business" },
      {
        property: "og:description",
        content:
          "Your business deserves a receptionist that never sleeps. Unlimited calls, lead capture, booking, 24/7.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  { icon: Bot, label: "1 AI voice agent trained on your business" },
  { icon: Phone, label: "Unlimited calls, 24/7" },
  { icon: UserPlus, label: "Lead capture — name, phone & email saved automatically" },
  { icon: FileText, label: "Full conversation transcripts" },
  { icon: BarChart3, label: "Analytics dashboard — call volume, peak hours, leads" },
  { icon: MessageSquare, label: "SMS follow-up after every call (optional)" },
  { icon: MessageCircle, label: "Live chat widget for your website" },
  { icon: Sparkles, label: "Personal AI assistant to manage your agent" },
  { icon: PhoneForwarded, label: "Instant human transfer for emergencies" },
  { icon: CalendarCheck, label: "Google Calendar booking integration" },
  { icon: PhoneCall, label: "One-click callback from your leads dashboard" },
  { icon: Rocket, label: "Full setup included — ready in minutes" },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-24">
        <Hero />
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
          Agent <span className="text-gold">Factory</span>
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

function Hero() {
  return (
    <section className="pt-16 pb-12 text-center">
      <div className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-foreground">
        AI Voice Agents for Your Business
      </div>
      <h1 className="mt-8 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
        Your business deserves a receptionist that{" "}
        <span className="italic text-gold">never sleeps</span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
        A custom AI voice agent trained on your business. Answers calls, captures leads,
        books appointments, and follows up automatically. 24/7.
      </p>
    </section>
  );
}

function PricingCard() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-sm md:p-10">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
          Elite Plan
        </p>
        <p className="mt-4 font-display text-7xl font-bold text-gold">$397</p>
        <p className="mt-2 text-sm text-muted-foreground">per month</p>
        <div className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm text-gold-foreground">
          Unlimited calls · Setup included · No contracts
        </div>
      </div>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({
            to: "/auth",
            search: {
              mode: "signup",
              email: email || undefined,
              business: businessName || undefined,
            },
          });
        }}
      >
        <input
          type="text"
          placeholder="Your business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-5 py-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          required
        />
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-5 py-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          required
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-5 py-5 text-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.99]"
        >
          Get Started — $397/mo
        </button>
      </form>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Secure checkout · Cancel anytime · 30-day money back
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Questions? Email{" "}
        <a
          href="mailto:ashtoncosta02@gmail.com"
          className="font-medium text-gold hover:underline"
        >
          ashtoncosta02@gmail.com
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
          href="mailto:ashtoncosta02@gmail.com"
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
        © {new Date().getFullYear()} Agent Factory. All rights reserved.
      </div>
    </footer>
  );
}
