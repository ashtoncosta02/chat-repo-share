import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFunnel } from "@/components/app-funnel/funnel-context";

export const Route = createFileRoute("/app/activate")({
  head: () => ({
    meta: [
      { title: "Activate Janice — Ask Janice app" },
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
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Activate Janice
      </h1>
      <p className="mt-2 text-muted-foreground">
        One plan, everything included. Start with a 7-day free trial — cancel
        anytime.
      </p>

      <div className="mt-6 rounded-2xl border border-primary bg-card p-5">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold text-foreground">$49</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <p className="mt-1 text-sm font-medium text-gold-foreground">
          7-day free trial included
        </p>
        <ul className="mt-4 space-y-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-foreground">
              <Check className="h-4 w-4 shrink-0 text-gold-foreground mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>

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
          Start free trial
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Design preview — no payment is taken.
        </p>
      </div>
    </div>
  );
}
