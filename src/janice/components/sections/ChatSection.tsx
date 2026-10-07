import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LockSimpleIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { JaniceMark } from "@/janice/components/Logo";
import { CheckList, Heading } from "@/janice/components/ui";

type Msg = { who: "janice" | "visitor"; text: string };

// Demo answers for an illustrative business. Real Janice answers from the owner’s own website.
const SUGGESTIONS: { q: string; a: string; keys: string[] }[] = [
  {
    q: "Are you open Saturdays?",
    a: "We are, 9 to 3. Want me to hold a spot? I just need your name and number.",
    keys: ["saturday", "sunday", "weekend", "open", "hours", "close"],
  },
  {
    q: "Do you handle emergencies?",
    a: "Yes. For leaks or no heat, I can put you straight through to the on-call tech right now.",
    keys: ["emergenc", "urgent", "leak", "burst", "flood", "asap"],
  },
  {
    q: "Can I get a quote?",
    a: "Of course. What’s the job, and which day works best for a quick site visit?",
    keys: ["quote", "price", "cost", "estimate", "how much"],
  },
];
const FALLBACK = "Good question. I’ll make sure the team has it. What’s the best number to reach you?";

export function ChatWidget() {
  const reduce = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: "janice", text: "Hi! I’m Janice. Ask me anything about Northside, or book a visit." },
  ]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, typing, reduce]);

  const send = (text: string, answer: string) => {
    if (typing) return;
    setMsgs((m) => [...m, { who: "visitor", text }]);
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { who: "janice", text: answer }]);
    }, reduce ? 200 : 1100 + Math.min(answer.length * 9, 900));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    const low = t.toLowerCase();
    const hit = SUGGESTIONS.find((s) => s.keys.some((k) => low.includes(k)));
    send(t, hit?.a ?? FALLBACK);
    setDraft("");
  };

  const remaining = SUGGESTIONS.filter((s) => !asked.includes(s.q));

  return (
    <div className="flex h-[460px] w-full flex-col overflow-hidden rounded-[24px] bg-aj-paper shadow-[inset_0_0_0_1px_var(--color-aj-line),0_30px_60px_-24px_rgb(53_34_106/0.4)]">
      <div className="flex items-center gap-3 bg-aj-violet px-4 py-3.5 text-aj-plum">
        <JaniceMark size={30} className="rounded-full ring-2 ring-white/60" />
        <div className="leading-tight">
          <p className="text-[14.5px] font-semibold">Janice</p>
          <p className="text-[12px] text-aj-plum/75">Northside Home Services</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/35 px-2.5 py-1 text-[11.5px] font-semibold">
          <span className="size-1.5 rounded-full bg-aj-signal" />
          Online
        </span>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {msgs.map((m, i) => (
          <motion.p
            key={i}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`max-w-[86%] px-3.5 py-2.5 text-[14px] leading-[1.5] ${m.who === "janice" ? "bubble-janice self-start" : "bubble-caller-violet self-end"}`}
          >
            {m.text}
          </motion.p>
        ))}
        <AnimatePresence>
          {typing && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="aj-bubble-janice inline-flex w-fit items-center gap-1.5 self-start px-3.5 py-3"
              aria-label="Janice is typing"
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="aj-typing-dot size-1.5 rounded-full bg-aj-violet" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {remaining.map((s) => (
            <button
              key={s.q}
              type="button"
              disabled={typing}
              onClick={() => {
                setAsked((a) => [...a, s.q]);
                send(s.q, s.a);
              }}
              className="rounded-full bg-aj-paper px-3 py-1.5 text-[12.5px] font-medium text-aj-violet-ink shadow-[inset_0_0_0_1px_var(--color-aj-lilac)] transition-colors hover:bg-aj-lavender disabled:opacity-50"
            >
              {s.q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-aj-line px-3 py-3">
        <label htmlFor="chat-demo-input" className="sr-only">
          Message Janice
        </label>
        <input
          id="chat-demo-input"
          name="message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-full bg-aj-mist px-4 text-[14px] text-aj-ink placeholder:text-aj-slate focus:outline-2 focus:outline-aj-violet-ink"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!draft.trim() || typing}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-aj-violet text-aj-plum transition-transform hover:-translate-y-0.5 disabled:opacity-45 disabled:hover:translate-y-0"
        >
          <PaperPlaneRightIcon size={18} weight="fill" />
        </button>
      </form>
    </div>
  );
}

export function ChatSection() {
  return (
    <section id="chat" aria-labelledby="chat-h" className="relative scroll-mt-20 overflow-x-clip">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <Heading id="chat-h" lead="Janice works on your website." payoff="No added cost." size="md" />
          <p className="mt-6 max-w-[34rem] text-[17.5px] leading-[1.65] text-aj-slate">
            Leads don’t only come from phone calls. Janice answers questions, captures contact details and books
            appointments right on your site, using the same knowledge she has from your phone setup.
          </p>
          <CheckList
            className="mt-8"
            items={[
              "Live chat bot included in your plan, nothing extra to buy",
              "Answers visitor questions instantly, day or night",
              "Captures name, phone and email without a phone call",
              "One line of code to install, no developer needed",
            ]}
          />
        </div>

        <div>
          <div className="relative overflow-hidden rounded-[28px] bg-aj-paper shadow-[inset_0_0_0_1px_var(--color-aj-line),var(--shadow-aj-lift)]">
            <div className="flex items-center gap-3 border-b border-aj-line bg-aj-haze px-4 py-3">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-aj-line" />
                <span className="size-2.5 rounded-full bg-aj-line" />
                <span className="size-2.5 rounded-full bg-aj-line" />
              </span>
              <span className="mx-auto flex items-center gap-1.5 rounded-full bg-aj-paper px-4 py-1.5 text-[12.5px] text-aj-slate shadow-[inset_0_0_0_1px_var(--color-aj-line)]">
                <LockSimpleIcon size={12} weight="bold" />
                northsidehome.ca
              </span>
            </div>
            <div className="relative grid min-h-[520px] place-items-end p-4 sm:p-6">
              {/* The "customer’s website" behind the widget. */}
              <img
                src="/img/aud-trades-1200.webp"
                srcSet="/img/aud-trades-640.webp 640w, /img/aud-trades-1200.webp 1200w"
                sizes="(min-width: 1024px) 640px, 100vw"
                alt=""
                width={1200}
                height={1607}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover object-[50%_30%]"
              />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(100deg,rgb(250_249_255/0.92)_0%,rgb(250_249_255/0.55)_45%,rgb(250_249_255/0.05)_75%)]" />
              <div aria-hidden className="absolute left-6 top-8 hidden max-w-[10rem] sm:left-8 sm:top-10 sm:block">
                <p className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.03em] text-aj-ink">Northside Home Services</p>
                <p className="mt-2 text-[13px] text-aj-slate">Renovations, repairs and installs since 2009.</p>
              </div>
              <div className="relative w-full sm:max-w-[316px]">
                <ChatWidget />
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-aj-slate">Try it: a live demo of the chat widget.</p>
        </div>
      </div>
    </section>
  );
}
