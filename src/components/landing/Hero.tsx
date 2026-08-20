import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Clock, Phone, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";

const script: { who: "caller" | "janice"; text: string }[] = [
  { who: "janice", text: "Thanks for calling Janice — this is Janice. How can I help?" },
  { who: "caller", text: "Hi, I need a quote for exterior caulking." },
  { who: "janice", text: "Happy to help. Can I grab your name and best phone number?" },
  { who: "caller", text: "Dave Miller — 289-555-0134." },
  { who: "janice", text: "Perfect, Dave. I have Thursday at 10:00 AM open — shall I book it?" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[var(--gold)] opacity-[0.13] blur-[130px]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 md:pb-28 md:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            AI receptionist for local business
          </span>

          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.03] tracking-tight md:text-6xl lg:text-[4.2rem]">
            <span className="block text-sm font-semibold uppercase tracking-[0.2em] text-gold">
              Ask Janice
            </span>
            Never miss another
            <br />
            <span className="italic text-gold">customer call</span>.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Janice answers your business phone 24/7, sounds like a real receptionist,
            captures every lead, and books appointments straight into your calendar —
            so you can keep working.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-7 py-4 text-base font-semibold text-[var(--gold-foreground)] shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:opacity-95"
            >
              Start your free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border border-border bg-card px-7 py-4 text-base font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-secondary"
            >
              See pricing
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold" /> Answers in under 2 seconds
            </li>
            <li className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4 text-gold" /> Unlimited calls, 24/7
            </li>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" /> Setup in minutes
            </li>
          </ul>
        </div>

        <CallMock />
      </div>
    </section>
  );
}

function CallMock() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(script.length);
      return;
    }
    const id = window.setInterval(() => {
      setStep((s) => (s >= script.length + 2 ? 0 : s + 1));
    }, 1600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-[var(--gold)] opacity-[0.08] blur-3xl"
      />
      <div className="relative rounded-[2rem] border border-border bg-card p-6 shadow-xl md:p-7">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-gold-foreground">
            <PhoneCall className="h-5 w-5" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-[var(--gold)] opacity-20" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Incoming call · (289) 555-0134</p>
            <p className="text-xs text-muted-foreground">Janice answered · live transcript</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--gold)]" />
            Live
          </span>
        </div>

        <div className="mt-4 min-h-[280px] space-y-3">
          {script.slice(0, Math.min(step, script.length)).map((line, i) => (
            <div
              key={line.text}
              className={`animate-in fade-in slide-in-from-bottom-2 duration-500 flex ${
                line.who === "caller" ? "justify-end" : "justify-start"
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <p
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  line.who === "caller"
                    ? "rounded-br-sm bg-secondary text-foreground"
                    : "rounded-bl-sm bg-accent text-accent-foreground"
                }`}
              >
                {line.text}
              </p>
            </div>
          ))}
          {step < script.length && (
            <div className="flex justify-start">
              <span className="inline-flex gap-1 rounded-2xl rounded-bl-sm bg-accent px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gold)]"
                    style={{ animationDelay: `${d * 120}ms` }}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        {step >= script.length && (
          <div className="animate-in fade-in slide-in-from-bottom-2 mt-4 flex flex-wrap gap-2 border-t border-border pt-4 duration-500">
            <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-gold-foreground">
              Lead saved · Dave Miller
            </span>
            <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-gold-foreground">
              Booked · Thu 10:00 AM
            </span>
            <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-gold-foreground">
              SMS follow-up sent
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
