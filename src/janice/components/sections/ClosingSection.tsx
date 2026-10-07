import { useRef } from "react";
import { useInView } from "motion/react";
import { ArrowRightIcon, EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { JaniceMark } from "@/janice/components/Logo";
import { Reveal } from "@/janice/components/ui";
import { CONTACT_EMAIL, PHONE_DISPLAY, PHONE_HREF, SIGNUP_HREF } from "@/janice/lib/site";

export function ClosingSection() {
  const ringRef = useRef<HTMLDivElement>(null);
  // Rings a few times each time it comes into view, then goes quiet.
  const ringing = useInView(ringRef, { amount: 0.6 });
  return (
    <section aria-labelledby="close-h" className="relative px-5 pb-16 pt-4 sm:px-8 md:pb-32">
      <Reveal variant="scale" className="relative mx-auto max-w-[1200px]">
        <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(160deg,#f1eeff_0%,#ffffff_48%,#efeaff_100%)] px-6 py-20 text-center shadow-[inset_0_0_0_1px_var(--color-aj-line),var(--shadow-aj-lift)] sm:px-12 md:py-28">
          <div aria-hidden className="aj-glow left-1/2 top-[62%] h-[420px] w-[720px] -translate-x-1/2 bg-[radial-gradient(closest-side,#ddd3ff,transparent)]" />

          {/* An incoming call: the mark, ringing. */}
          <div ref={ringRef} aria-hidden data-ringing={ringing ? "1" : undefined} className="aj-ringer relative mx-auto grid size-[88px] place-items-center">
            <span className="aj-ring-pulse absolute inset-0 rounded-full border-2 border-aj-violet/50" />
            <span className="aj-ring-pulse absolute inset-0 rounded-full border-2 border-aj-violet/50 [animation-delay:0.6s]" />
            <span className="aj-ring-pulse absolute inset-0 rounded-full border-2 border-aj-violet/50 [animation-delay:1.2s]" />
            <JaniceMark size={88} className="aj-ring-buzz relative drop-shadow-[0_16px_30px_rgba(158,76,255,0.45)]" />
          </div>

          <h2 id="close-h" className="aj-display relative mx-auto mt-10 max-w-[44rem] text-[38px] leading-[1.05] text-aj-ink sm:text-[56px] lg:text-[64px]">
            Your next customer is calling <span className="aj-payoff inline-block pb-1">right now.</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-[32rem] text-[17.5px] leading-[1.65] text-aj-slate">
            Let Janice pick up. Start your free trial and hear her answer your business line today.
          </p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href={SIGNUP_HREF} className="aj-btn aj-btn-primary h-14 px-7 text-[16px]">
              Start free trial
              <ArrowRightIcon size={17} weight="bold" className="aj-arrow" />
            </a>
            <a href={PHONE_HREF} className="aj-btn aj-btn-secondary aj-num h-14 px-6 text-[16px]">
              <PhoneIcon size={18} weight="duotone" className="text-aj-violet-ink" />
              {PHONE_DISPLAY}
            </a>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="relative mt-6 inline-flex items-center gap-2 text-[14.5px] text-aj-slate underline decoration-aj-lilac hover:text-aj-ink hover:decoration-aj-violet-ink"
          >
            <EnvelopeSimpleIcon size={16} weight="duotone" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </Reveal>
    </section>
  );
}
