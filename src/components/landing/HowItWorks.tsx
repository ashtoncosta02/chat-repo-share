import { Globe, PhoneIncoming, CalendarCheck } from "lucide-react";
import { Reveal } from "./Reveal";

const steps = [
  {
    icon: Globe,
    title: "Tell Janice about your business",
    body: "Paste your website and she learns your services, hours, and pricing in seconds. Add FAQs any time.",
  },
  {
    icon: PhoneIncoming,
    title: "Connect a number",
    body: "Get a new local number or forward your existing one. If you don't pick up, Janice answers instantly.",
  },
  {
    icon: CalendarCheck,
    title: "She answers, books, follows up",
    body: "Every call is answered, transcribed, saved as a lead, booked into your calendar, and texted a follow-up.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">How it works</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Live in minutes, not weeks
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          No installers, no phone system to rip out. Three steps and your phone stops ringing out.
        </p>
      </Reveal>

      <div className="relative mt-14 grid gap-6 md:grid-cols-3">
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[3.25rem] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
        />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 120}>
            <div className="relative h-full rounded-3xl border border-border bg-card p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-gold-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-sm font-bold text-gold">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
