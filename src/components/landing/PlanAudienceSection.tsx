import { HammerIcon, ScalesIcon, ScissorsIcon, StethoscopeIcon } from "@phosphor-icons/react";
import { Heading, Reveal } from "@/janice/components/ui";

const AUDIENCES = [
  { icon: HammerIcon, title: "Trades & home services", body: "You’re on a ladder, not by the phone. Janice quotes, qualifies and books the site visit." },
  { icon: StethoscopeIcon, title: "Clinics & practices", body: "Front desk overflow, after-hours calls and appointment requests, handled without hold music." },
  { icon: ScissorsIcon, title: "Salons & studios", body: "Every booking request answered mid-appointment, so walk-in revenue never rings out." },
  { icon: ScalesIcon, title: "Legal & consulting", body: "New enquiries screened, details captured and consultations scheduled, 24 hours a day." },
];

/** Who Janice is for — simple icon cards (the stock-style photos were removed). */
export function PlanAudienceSection() {
  return (
    <section aria-labelledby="who-h" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:py-32">
        <Reveal className="max-w-[44rem]">
          <Heading id="who-h" lead="Built for busy" payoff="local businesses." />
          <p className="mt-5 max-w-[34rem] text-[17.5px] leading-[1.65] text-aj-slate">
            If your hands are full when the phone rings, Janice was made for you.
          </p>
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.title} className="rounded-[var(--radius-aj-card)] bg-aj-paper p-6 shadow-[inset_0_0_0_1px_var(--color-aj-line),var(--shadow-aj-card)]">
                <span className="grid size-11 place-items-center rounded-full bg-aj-haze text-aj-violet-ink">
                  <Icon size={22} weight="duotone" />
                </span>
                <h3 className="mt-5 font-display text-[19px] font-bold leading-[1.2] tracking-[-0.02em] text-aj-ink">{a.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.55] text-aj-slate">{a.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
