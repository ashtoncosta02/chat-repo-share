import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { Reveal } from "./Reveal";

export function CTABand() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-[image:var(--gradient-brand)] px-8 py-14 text-center md:px-16 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[var(--gold)] opacity-20 blur-3xl"
          />
          <h2 className="relative font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Your next customer is calling right now
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Let Janice pick up. Start your free trial and hear her answer your business line today.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-8 py-4 text-base font-semibold text-[var(--gold-foreground)] shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:opacity-95"
            >
              Start your free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="tel:+12899071201"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-8 py-4 text-base font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-secondary"
            >
              <Phone className="h-4 w-4" />
              (289) 907-1201
            </a>
          </div>
          <p className="relative mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <a href="mailto:hello@askjanice.net" className="hover:text-foreground">
              hello@askjanice.net
            </a>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
