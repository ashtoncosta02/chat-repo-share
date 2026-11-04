import { Heading, Reveal } from "@/janice/components/ui";
import { PlanOptions } from "@/components/PlanOptions";

export function PricingSection() {
  return <section id="pricing" aria-labelledby="pricing-h" className="relative scroll-mt-20"><div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:py-32"><Reveal><Heading id="pricing-h" lead="Two simple" payoff="plans." /><p className="mt-6 text-aj-slate">One AI Receptionist. Choose the call allowance and features your business needs.</p></Reveal><PlanOptions /><p className="mt-6 text-sm text-aj-slate">30-day money-back guarantee · No contracts · Setup included</p></div></section>;
}