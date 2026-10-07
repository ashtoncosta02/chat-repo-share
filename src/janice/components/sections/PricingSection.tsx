import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { ArrowRightIcon, CheckIcon, CreditCardIcon, LockSimpleIcon, ShieldCheckIcon, XCircleIcon } from "@phosphor-icons/react";
import { Heading, Reveal } from "@/janice/components/ui";
import { CONTACT_EMAIL, PHONE_DISPLAY, PHONE_HREF, SIGNUP_HREF } from "@/janice/lib/site";

const PLAN = [
  "1 AI receptionist trained on your business",
  "Unlimited calls, 24/7",
  "Lead capture: name, phone and email saved automatically",
  "Full conversation transcripts",
  "Analytics dashboard: call volume, peak hours, leads",
  "SMS follow-up after every call (optional)",
  "Live chat bot for your website",
  "Instant human transfer for emergencies",
  "Google Calendar and Outlook booking",
  "One-click callback from your leads dashboard",
];

/** $49 rolls up once when the card arrives (the same beat as the ads). */
function Price() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView || reduce || !ref.current) return;
    const el = ref.current;
    const c = animate(0, 49, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = `$${Math.round(v)}`),
    });
    return () => c.stop();
  }, [inView, reduce]);
  return (
    <span ref={ref} className="aj-num aj-display block text-[88px] leading-none text-aj-violet sm:text-[104px]">
      $49
    </span>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="relative scroll-mt-20 overflow-x-clip">
      <div aria-hidden className="aj-glow left-[45%] top-[18%] h-[600px] w-[700px] bg-[radial-gradient(closest-side,#e9e3ff,transparent)]" />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-[auto_1fr] lg:gap-x-20 lg:gap-y-10">
        {/* Order: heading, then the price card, then the reassurance (mobile reads price before guarantee). */}
        <Reveal className="lg:col-start-1 lg:row-start-1 lg:self-start lg:pt-10">
          <Heading id="pricing-h" lead="One simple" payoff="plan." />
          <p className="mt-6 max-w-[30rem] text-[17.5px] leading-[1.65] text-aj-slate">
            Everything included. No per-minute fees, no setup fees, no contracts.
          </p>
        </Reveal>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <div className="aj-card-lift relative overflow-hidden p-7 sm:p-10">
            <div aria-hidden className="aj-glow -right-24 -top-28 h-[300px] w-[300px] bg-[radial-gradient(closest-side,#e6dfff,transparent)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-[19px] font-bold tracking-[-0.02em] text-aj-ink">Elite Plan</p>
              <span className="rounded-full bg-aj-violet px-3 py-1.5 text-[12px] font-bold text-aj-plum">Most popular</span>
            </div>
            <div className="relative mt-6 flex items-end gap-3">
              <Price />
              <span className="pb-3 text-[16px] text-aj-slate">per month</span>
            </div>
            <p className="relative mt-4 inline-flex rounded-full bg-aj-lavender px-3.5 py-1.5 text-[13px] font-semibold text-aj-grape">
              Unlimited calls, no contracts
            </p>
            <ul className="relative mt-8 grid gap-x-8 gap-y-3.5 border-t border-aj-line pt-8 sm:grid-cols-2">
              {PLAN.map((f) => (
                <li key={f} className="flex gap-2.5 text-[14.5px] leading-[1.45] text-aj-ink/85">
                  <CheckIcon size={16} weight="bold" className="mt-[2px] shrink-0 text-aj-violet-ink" />
                  {f}
                </li>
              ))}
            </ul>
            <a href={SIGNUP_HREF} className="aj-btn aj-btn-primary relative mt-9 h-14 w-full text-[16px]">
              Start free trial
              <ArrowRightIcon size={17} weight="bold" className="aj-arrow" />
            </a>
            <ul className="relative mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-aj-slate">
              <li className="inline-flex items-center gap-1.5">
                <LockSimpleIcon size={14} weight="duotone" /> Secure checkout
              </li>
              <li className="inline-flex items-center gap-1.5">
                <XCircleIcon size={14} weight="duotone" /> Cancel anytime
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CreditCardIcon size={14} weight="duotone" /> 30-day money back
              </li>
            </ul>
            <p className="relative mt-4 text-center text-[13px] text-aj-slate">
              Questions? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-aj-violet-ink underline decoration-aj-lilac hover:decoration-aj-violet-ink">
                {CONTACT_EMAIL}
              </a>{" "}
              or call{" "}
              <a href={PHONE_HREF} className="aj-num text-aj-violet-ink underline decoration-aj-lilac hover:decoration-aj-violet-ink">
                {PHONE_DISPLAY}
              </a>
            </p>
          </div>
        </div>
        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <div className="flex items-start gap-4 rounded-[22px] bg-aj-paper p-5 shadow-[inset_0_0_0_1px_var(--color-aj-line)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-aj-lavender text-aj-violet-ink">
              <ShieldCheckIcon size={22} weight="duotone" />
            </span>
            <div>
              <p className="font-display text-[17px] font-bold tracking-[-0.02em] text-aj-ink">30-day money-back guarantee</p>
              <p className="mt-1 text-[14.5px] leading-[1.55] text-aj-slate">
                If Janice isn’t right for your business in the first 30 days, email us and we’ll refund you.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-[30rem] text-[14.5px] leading-[1.6] text-aj-slate">
            <span className="font-semibold text-aj-ink">Need more receptionists?</span> Additional receptionists for multiple
            locations or departments are available.{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-aj-violet-ink underline decoration-aj-lilac hover:decoration-aj-violet-ink">
              Contact us for custom pricing.
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
