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
import { PlanOptions } from "@/components/PlanOptions";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Ask Janice" },
      {
        name: "description",
        content:
          "Essential $79/month with 200 call minutes; Elite $139/month with 750 call minutes. Both include a 7-day free trial.",
      },
      { property: "og:title", content: "Pricing — Ask Janice" },
      {
        property: "og:description",
        content:
          "Essential $79/month with 200 call minutes; Elite $139/month with 750 call minutes. Both include a 7-day free trial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://askjanice.net/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://askjanice.net/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return <div className="min-h-screen bg-background text-foreground"><header className="border-b border-border"><div className="mx-auto flex max-w-6xl justify-between px-6 py-5"><Link to="/" className="font-display text-2xl font-bold">Ask Janice</Link><Link to="/auth">Sign in</Link></div></header><main className="mx-auto max-w-5xl px-6 py-10"><h1 className="font-display text-3xl font-bold text-center">Choose your plan</h1><PlanOptions /><p className="mt-8 text-center text-sm text-muted-foreground">Secure checkout · Cancel anytime · 30-day money back</p></main><footer className="border-t border-border py-8 text-center text-sm"><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/refund-policy">Refunds</Link></footer></div>;
}
