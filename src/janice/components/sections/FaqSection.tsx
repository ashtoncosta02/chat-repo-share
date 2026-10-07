import { useId, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Heading } from "@/janice/components/ui";
import { CONTACT_EMAIL, PHONE_DISPLAY, PHONE_HREF } from "@/janice/lib/site";

const FAQ = [
  {
    q: "How long does setup take?",
    a: "Most businesses are live in under 15 minutes. You paste your website, Janice learns your services and hours, you pick a voice and connect a number. That’s it. Full setup help is included.",
  },
  {
    q: "Can I keep my existing business number?",
    a: "Yes. You can forward your current number to Janice, or get a new local number inside the dashboard. With forwarding, your phone rings first and Janice only picks up if you don’t.",
  },
  {
    q: "What happens if she can’t answer something?",
    a: "Janice can transfer the call to you or a teammate instantly for urgent situations, or take a message and send you the full transcript, caller details and a summary by email and SMS.",
  },
  {
    q: "Does she work with my calendar?",
    a: "Janice books into Google Calendar or Microsoft Outlook using your real business hours, and every booking shows up in your dashboard too.",
  },
  {
    q: "Is there a contract?",
    a: "No contracts. It’s $49 per month, cancel any time from your account page. Unlimited calls are included, with no per-minute charges.",
  },
  {
    q: "What’s your refund policy?",
    a: "30-day money-back guarantee. If Janice isn’t right for your business in the first 30 days, email hello@askjanice.net and we’ll refund you.",
  },
];

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className={`rounded-[22px] transition-colors duration-300 ${open ? "bg-aj-paper shadow-[inset_0_0_0_1px_var(--color-aj-line),var(--shadow-aj-card)]" : "bg-transparent"}`}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 rounded-[22px] px-5 py-5 text-left font-display text-[17.5px] font-bold tracking-[-0.02em] text-aj-ink sm:px-6"
        >
          {q}
          <span
            aria-hidden
            className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${open ? "rotate-45 bg-aj-violet text-aj-plum" : "bg-aj-lavender text-aj-violet-ink"}`}
          >
            <PlusIcon size={15} weight="bold" />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-btn`}
        className={`grid transition-[grid-template-rows] duration-500 ease-[var(--ease-aj-expo)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="max-w-[40rem] px-5 pb-6 text-[15.5px] leading-[1.65] text-aj-slate sm:px-6">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" aria-labelledby="faq-h" className="relative scroll-mt-20 bg-[linear-gradient(180deg,transparent,rgb(243_242_253/0.7)_15%,rgb(243_242_253/0.7)_85%,transparent)]">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Heading id="faq-h" lead="Questions," payoff="answered." />
          <p className="mt-6 max-w-[24rem] text-[16px] leading-[1.65] text-aj-slate">
            Something else? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-aj-violet-ink underline decoration-aj-lilac hover:decoration-aj-violet-ink">
              {CONTACT_EMAIL}
            </a>{" "}
            or call{" "}
            <a href={PHONE_HREF} className="aj-num whitespace-nowrap text-aj-violet-ink underline decoration-aj-lilac hover:decoration-aj-violet-ink">
              {PHONE_DISPLAY}
            </a>
            .
          </p>
        </div>
        <div className="grid gap-2">
          {FAQ.map((f, i) => (
            <Item key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
