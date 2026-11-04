import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

export const SHARED_FEATURES = ["1 AI Receptionist trained on your business", "24/7 phone answering and website chat", "Google Calendar and Outlook appointment booking", "Lead capture, transcripts and analytics", "SMS follow-up and transcript notifications", "One-click callbacks and business knowledge", "Setup included"];

export function PlanOptions({ preview = false, onSelect }: { preview?: boolean; onSelect?: (id: PlanId) => void }) {
  const { user } = useAuth();
  const { openCheckout, checkoutElement } = useStripeCheckout();
  const [selected, setSelected] = useState<PlanId>("essential_monthly");
  return <><div className="mt-6 grid gap-5 md:grid-cols-2">{Object.entries(PLANS).map(([key, plan]) => {
    const id = key as PlanId;
    const features = [`${plan.callMinutes} call minutes per month`, plan.scenarioLimit === null ? "Unlimited scenarios" : "Up to 3 scenarios", plan.humanTransfer ? "Instant human transfer included" : "No instant human transfer", ...SHARED_FEATURES, ...(plan.futureEmail ? ["Email integration when it launches — not available yet"] : [])];
    return <article key={id} className="rounded-lg border border-border bg-card p-5"><h2 className="font-display text-xl font-bold">{plan.name}</h2><p className="mt-3"><strong className="font-display text-4xl">${plan.monthlyPrice}</strong><span className="text-muted-foreground">/month</span></p><p className="mt-2 text-sm text-muted-foreground">7-day free trial · Card required · Cancel anytime</p><ul className="mt-5 space-y-3">{features.map(f => <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>{preview ? <Button variant={selected === id ? "default" : "outline"} aria-pressed={selected === id} className="mt-6 w-full" onClick={() => { setSelected(id); onSelect?.(id); }}>{selected === id ? `${plan.name} selected` : `Choose ${plan.name}`}</Button> : user ? <Button className="mt-6 w-full" onClick={() => openCheckout({ priceId: id, trialDays: 7, returnUrl: `${window.location.origin}/dashboard?checkout=success` })}>Start {plan.name} free trial</Button> : <Button asChild className="mt-6 w-full"><Link to="/auth" search={{ mode: "signup", next: `/dashboard/account?plan=${id}` } as never}>Start {plan.name} free trial</Link></Button>}</article>;
  })}</div>{checkoutElement}</>;
}