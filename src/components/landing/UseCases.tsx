import { Hammer, Stethoscope, Scissors, Scale } from "lucide-react";
import { Reveal } from "./Reveal";

const cases = [
  {
    icon: Hammer,
    title: "Trades & home services",
    body: "You're on a ladder, not by the phone. Janice quotes, qualifies and books the site visit.",
  },
  {
    icon: Stethoscope,
    title: "Clinics & practices",
    body: "Front desk overflow, after-hours calls and appointment requests handled without hold music.",
  },
  {
    icon: Scissors,
    title: "Salons & studios",
    body: "Every booking request answered mid-appointment, so walk-in revenue never rings out.",
  },
  {
    icon: Scale,
    title: "Legal & consulting",
    body: "New enquiries screened, details captured, consultations scheduled — 24 hours a day.",
  },
];

export function UseCases() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Who it's for</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Built for busy local businesses
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cases.map((c, i) => (
          <Reveal key={c.title} delay={i * 100}>
            <div className="h-full rounded-3xl border border-border bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-gold-foreground">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold tracking-tight">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
