import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./Reveal";

const faqs = [
  {
    q: "How long does setup take?",
    a: "Most businesses are live in under 15 minutes. You paste your website, Janice learns your services and hours, you pick a voice and connect a number — that's it. Full setup help is included.",
  },
  {
    q: "Can I keep my existing business number?",
    a: "Yes. You can forward your current number to Janice, or get a new local number inside the dashboard. With forwarding, your phone rings first and Janice only picks up if you don't.",
  },
  {
    q: "What happens if she can't answer something?",
    a: "Janice can transfer the call to you or a teammate instantly for urgent situations, or take a message and send you the full transcript, caller details and a summary by email and SMS.",
  },
  {
    q: "Does she work with my calendar?",
    a: "Janice books into Google Calendar or Microsoft Outlook using your real business hours, and every booking shows up in your dashboard too.",
  },
  {
    q: "Is there a contract?",
    a: "No contracts. It's $49 per month, cancel any time from your account page. Unlimited calls are included — no per-minute charges.",
  },
  {
    q: "What's your refund policy?",
    a: "30-day money-back guarantee. If Janice isn't right for your business in the first 30 days, email hello@askjanice.net and we'll refund you.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="scroll-mt-24 bg-secondary/40 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">FAQ</p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Questions, answered
          </h2>
        </Reveal>

        <Reveal delay={100} className="mt-10">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f) => (
              <AccordionItem
                key={f.q}
                value={f.q}
                className="rounded-2xl border border-border bg-card px-5 shadow-sm"
              >
                <AccordionTrigger className="py-5 text-left font-display text-base font-semibold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
