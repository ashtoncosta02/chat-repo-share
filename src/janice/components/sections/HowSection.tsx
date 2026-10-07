import { motion, useReducedMotion } from "motion/react";
import { CheckIcon, GlobeHemisphereWestIcon, PhoneCallIcon } from "@phosphor-icons/react";
import { Heading, Reveal } from "@/janice/components/ui";

const EASE = [0.16, 1, 0.3, 1] as const;

function LearnVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="flex items-center gap-2.5 rounded-full bg-aj-paper px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-aj-line)]">
        <GlobeHemisphereWestIcon size={18} weight="duotone" className="shrink-0 text-aj-violet-ink" />
        <span className="truncate text-[14px] text-aj-ink">northsidehome.ca</span>
        <span className="relative ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-aj-lavender">
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full bg-aj-violet"
            initial={reduce ? false : { width: "0%" }}
            whileInView={{ width: "100%" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
          />
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {["Services", "Hours", "Pricing", "FAQs"].map((c, i) => (
          <motion.span
            key={c}
            className="aj-chip"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: EASE, delay: 1.2 + i * 0.15 }}
          >
            <CheckIcon size={12} weight="bold" />
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function NumberVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-aj-paper px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--color-aj-line)]">
        <PhoneCallIcon size={20} weight="duotone" className="text-aj-violet-ink" />
        <span className="aj-num text-[16px] font-semibold tracking-[-0.01em] text-aj-ink">(289) 555-0134</span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-aj-paper px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-aj-line)]">
        <span className="text-[13.5px] text-aj-ink">Forward my existing number</span>
        <span className="relative h-6 w-10 shrink-0 rounded-full bg-aj-violet">
          <motion.span
            className="absolute top-1 size-4 rounded-full bg-aj-paper shadow"
            initial={reduce ? false : { left: 4 }}
            whileInView={{ left: 20 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.6 }}
          />
        </span>
      </div>
      <p className="px-1 text-[12.5px] text-aj-slate">Your phone rings first. Janice picks up if you don’t.</p>
    </div>
  );
}

function FollowVisual() {
  const reduce = useReducedMotion();
  const rows = ["Call answered", "Lead saved", "Booked Thu 10:00 AM", "Follow-up text sent"];
  return (
    <ul className="flex h-full flex-col justify-center gap-2">
      {rows.map((r, i) => (
        <motion.li
          key={r}
          className="flex items-center gap-2.5 rounded-xl bg-aj-paper px-3.5 py-2.5 text-[13.5px] text-aj-ink shadow-[inset_0_0_0_1px_var(--color-aj-line)]"
          initial={reduce ? false : { opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.22 }}
        >
          <span className="grid size-5 place-items-center rounded-full bg-aj-violet text-aj-plum">
            <CheckIcon size={11} weight="bold" />
          </span>
          {r}
        </motion.li>
      ))}
    </ul>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Tell Janice about your business",
    body: "Paste your website and she learns your services, hours and pricing in seconds. Add FAQs any time.",
    Visual: LearnVisual,
  },
  {
    n: "2",
    title: "Connect a number",
    body: "Get a new local number or forward your existing one. If you don’t pick up, Janice answers instantly.",
    Visual: NumberVisual,
  },
  {
    n: "3",
    title: "She answers, books, follows up",
    body: "Every call is answered, transcribed, saved as a lead, booked into your calendar and texted a follow-up.",
    Visual: FollowVisual,
  },
];

export function HowSection() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" aria-labelledby="how-h" className="relative scroll-mt-20 bg-[linear-gradient(180deg,transparent,rgb(243_242_253/0.65)_18%,rgb(243_242_253/0.65)_82%,transparent)]">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 md:py-32">
        <Reveal className="mx-auto max-w-[44rem] text-center">
          <Heading id="how-h" lead="Live in minutes," payoff="not weeks." />
          <p className="mx-auto mt-5 max-w-[34rem] text-[17.5px] leading-[1.65] text-aj-slate">
            No installers, no phone system to rip out. Three steps and your phone stops ringing out.
          </p>
        </Reveal>

        <ol className="relative mt-16 grid gap-12 md:mt-20 md:grid-cols-3 md:gap-8">
          {/* The connecting line draws as the section arrives. */}
          <motion.span
            aria-hidden
            className="absolute left-[16.6%] right-[16.6%] top-[19px] hidden h-[2px] origin-left rounded-full bg-[linear-gradient(90deg,var(--color-aj-violet),var(--color-aj-lilac))] md:block"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
          {/* A call signal travels the path once, step 1 to step 3. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-[14px] hidden h-3 md:block"
            initial={reduce ? false : { x: "0%", opacity: 0 }}
            whileInView={{ x: "100%", opacity: [0, 1, 1, 0] }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1.8, delay: 0.5, ease: [0.65, 0, 0.35, 1], opacity: { duration: 1.8, delay: 0.5, times: [0, 0.1, 0.85, 1] } }}
          >
            <span className="absolute -left-1.5 top-0 block size-3 rounded-full bg-aj-brand shadow-[0_0_0_5px_rgb(158_76_255/0.18),0_0_18px_rgb(158_76_255/0.6)]" />
          </motion.span>
          {STEPS.map(({ n, title, body, Visual }) => (
            <li key={n} className="relative flex flex-col items-center text-center">
              <span className="relative z-[1] grid size-10 place-items-center rounded-full bg-aj-paper font-display text-[16px] font-bold text-aj-violet-ink shadow-[inset_0_0_0_2px_var(--color-aj-violet),0_0_0_6px_var(--color-aj-cream)]">
                {n}
              </span>
              <h3 className="mt-6 font-display text-[21px] font-bold tracking-[-0.025em] text-aj-ink">{title}</h3>
              <p className="mt-2.5 max-w-[22rem] text-[15.5px] leading-[1.6] text-aj-slate">{body}</p>
              <div className="mt-7 h-[188px] w-full max-w-[340px] rounded-[var(--radius-aj-tile)] bg-[linear-gradient(160deg,#efecff,#f7f6ff)] p-5 text-left shadow-[inset_0_0_0_1px_var(--color-aj-line-soft)]">
                <Visual />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
