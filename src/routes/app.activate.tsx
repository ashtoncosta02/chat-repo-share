import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFunnel } from "@/components/app-funnel/funnel-context";
import { PlanOptions } from "@/components/PlanOptions";
import { PLANS, type PlanId } from "@/lib/plans";

export const Route = createFileRoute("/app/activate")({
  head: () => ({
    meta: [
      { title: "Activate Janice — Ask Janice app" },
      { name: "description", content: "Choose Essential at $79/month or Elite at $139/month for your Ask Janice AI Receptionist." },
      { property: "og:title", content: "Activate Janice — Ask Janice app" },
      { property: "og:description", content: "Essential and Elite plans, both with a 7-day free trial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivateStep,
});

const INCLUDED = [
  "Janice answers every call and website chat, 24/7",
  "Appointments booked straight into your calendar",
  "Lead details texted and emailed after every call",
  "Your own local phone number included",
];

function ActivateStep() {
  const { data } = useFunnel();
  const [activated, setActivated] = useState(false);
  const [planId, setPlanId] = useState<PlanId>("essential_monthly");
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => setSignedIn(!!s.session));
  }, []);
  const business = data.businessName.trim() || "your business";

  if (activated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft">
          <PartyPopper className="h-8 w-8 text-gold-foreground" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold text-foreground">
          Janice is ready for {business}
        </h1>
        <p className="mt-3 text-muted-foreground">
          In the finished app, this is where Janice goes live and your 7-day
          free trial begins. This screen is a design preview, so nothing has
          been activated or charged.
        </p>
        <Button asChild size="lg" className="mt-8 w-full">
          {signedIn ? (
            <Link to="/dashboard/conversations">Go to my dashboard</Link>
          ) : (
            <Link to="/auth">Sign in to my dashboard</Link>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Activate Janice
      </h1>
      <p className="mt-2 text-muted-foreground">
        Two plans. Both include a 7-day free trial — cancel
        anytime.
      </p>

      <PlanOptions preview onSelect={setPlanId} />

      <div className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
        <p className="text-xs text-muted-foreground">
          In the finished iPhone and Android app, this step will use the app
          stores' own secure in-app purchase — your card is never handled by
          Ask Janice directly. You'll confirm the price and trial terms with
          your store account before anything is charged.
        </p>
      </div>

      <div className="mt-auto pt-8">
        <Button size="lg" className="w-full" onClick={() => setActivated(true)}>
          Preview {PLANS[planId].name} activation
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Design preview — no payment is taken.
        </p>
      </div>
    </div>
  );
}
