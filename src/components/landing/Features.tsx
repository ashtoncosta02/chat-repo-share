import {
  Bot,
  Phone,
  UserPlus,
  FileText,
  BarChart3,
  MessageSquare,
  MessageCircle,
  PhoneForwarded,
  CalendarCheck,
  PhoneCall,
  Rocket,
} from "lucide-react";
import { Reveal } from "./Reveal";

const smallFeatures = [
  { icon: Bot, label: "1 AI receptionist trained on your business" },
  { icon: Phone, label: "Unlimited calls, 24/7" },
  { icon: UserPlus, label: "Lead capture — name, phone & email saved automatically" },
  { icon: FileText, label: "Full conversation transcripts" },
  { icon: BarChart3, label: "Analytics — call volume, peak hours, leads" },
  { icon: MessageSquare, label: "SMS follow-up after every call (optional)" },
  { icon: MessageCircle, label: "Live chat widget for your website" },
  { icon: PhoneForwarded, label: "Instant human transfer for emergencies" },
  { icon: PhoneCall, label: "One-click callback from your leads dashboard" },
  { icon: Rocket, label: "Full setup included — ready in minutes" },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Features</p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Everything included — no add-ons
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One plan, one price, every feature switched on from day one.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-3xl border border-border bg-card p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-gold-foreground">
                <Phone className="h-5 w-5" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">
                A receptionist who sounds human
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Natural voice, your greeting, your tone. Janice handles questions about your
                services, hours and pricing, screens the call, and transfers to you the moment
                it's urgent.
              </p>
            </article>
          </Reveal>

          <Reveal delay={120}>
            <article className="h-full rounded-3xl border border-border bg-card p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-gold-foreground">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">
                Books straight into your calendar
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Google Calendar and Outlook integration with your real business hours. Janice
                offers open slots on the call and the appointment is on your calendar before
                you hang up.
              </p>
            </article>
          </Reveal>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {smallFeatures.map((f, i) => (
            <Reveal key={f.label} delay={(i % 3) * 90}>
              <div className="flex h-full items-center gap-4 rounded-2xl border border-border bg-card p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-gold-foreground">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-sm leading-snug text-foreground">{f.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
