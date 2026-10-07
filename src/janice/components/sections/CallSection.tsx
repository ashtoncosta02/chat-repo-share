import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion, motion, AnimatePresence } from "motion/react";
import { ArrowCounterClockwiseIcon, CalendarCheckIcon, ChatTextIcon, PhoneIcon, UserCirclePlusIcon } from "@phosphor-icons/react";
import { CheckList, Heading } from "@/janice/components/ui";

type Line = { who: "janice" | "caller"; text: string };

// Illustrative call, same scenario as the live site’s hero demo.
const SCRIPT: Line[] = [
  { who: "janice", text: "Thanks for calling Northside Home Services, this is Janice. How can I help?" },
  { who: "caller", text: "Hi, I need a quote for exterior caulking." },
  { who: "janice", text: "Happy to help. Can I grab your name and best phone number?" },
  { who: "caller", text: "Dave Miller, 289-555-0134." },
  { who: "janice", text: "Perfect, Dave. I have Thursday at 10:00 AM open. Shall I book it?" },
  { who: "caller", text: "Yes please, that works." },
];

const OUTCOMES = [
  { icon: UserCirclePlusIcon, label: "Lead saved: Dave Miller" },
  { icon: CalendarCheckIcon, label: "Booked Thu 10:00 AM" },
  { icon: ChatTextIcon, label: "SMS follow-up sent" },
];

function VoiceBars({ active }: { active: boolean }) {
  return (
    <span aria-hidden className={`aj-voice-bars inline-flex h-4 items-center gap-[3px] ${active ? "is-active" : ""}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="block w-[3px] rounded-full bg-aj-violet" style={{ animationDelay: `${i * 0.11}s` }} />
      ))}
    </span>
  );
}

function CallCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? SCRIPT.length : 0);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(!!reduce);
  const [secs, setSecs] = useState(0);
  const [run, setRun] = useState(0);
  const started = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (reduce || !inView || started.current) return;
    started.current = true;
    const timers = timersRef.current;
    let t = 500;
    SCRIPT.forEach((line, i) => {
      if (line.who === "janice") {
        timers.push(window.setTimeout(() => setTyping(true), t));
        t += 900;
      }
      timers.push(
        window.setTimeout(() => {
          setTyping(false);
          setShown(i + 1);
        }, t),
      );
      t += 650 + line.text.length * 26;
    });
    timers.push(window.setTimeout(() => setDone(true), t));
  }, [inView, reduce, run]);

  useEffect(() => {
    if (reduce || !started.current || done) return;
    const id = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [done, reduce, shown]);

  const replay = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    started.current = false;
    setShown(0);
    setDone(false);
    setSecs(0);
    setRun((r) => r + 1);
  };

  const speaking = typing || (shown > 0 && SCRIPT[shown - 1]?.who === "janice" && !done);
  const mm = String(Math.floor(secs / 60));
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div ref={ref} className="aj-card-lift relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-center gap-3.5 border-b border-aj-line pb-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-aj-lavender text-aj-violet-ink">
          <PhoneIcon size={21} weight="duotone" />
          {!done && (
            <>
              <span aria-hidden className="aj-call-ripple absolute inset-0 rounded-full border-2 border-aj-brand/45" />
              <span aria-hidden className="aj-call-ripple absolute inset-0 rounded-full border-2 border-aj-brand/45 [animation-delay:0.6s]" />
            </>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-aj-ink">Incoming call: (289) 555-0134</p>
          <p className="mt-0.5 flex items-center gap-2 text-[13px] text-aj-slate">
            Janice answered <VoiceBars active={speaking} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${done ? "bg-aj-mist text-aj-slate" : "bg-aj-lavender text-aj-grape"}`}>
            <span className={`size-1.5 rounded-full ${done ? "bg-aj-slate-soft" : "bg-aj-violet animate-pulse"}`} />
            {done ? "Ended" : "Live"}
          </span>
          <span className="aj-num text-[12px] text-aj-slate">
            {mm}:{ss}
          </span>
        </div>
      </div>

      <div className="flex min-h-[372px] flex-col gap-2.5 pt-4" aria-live="polite">
        {SCRIPT.slice(0, shown).map((l, i) => (
          <motion.p
            key={`${run}-${i}`}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`max-w-[84%] px-4 py-2.5 text-[14.5px] leading-[1.5] ${l.who === "janice" ? "bubble-janice self-start" : "bubble-caller-violet self-end"}`}
          >
            {l.text}
          </motion.p>
        ))}
        <AnimatePresence>
          {typing && (
            <motion.span
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="aj-bubble-janice inline-flex w-fit items-center gap-1.5 self-start px-4 py-3.5"
              aria-label="Janice is replying"
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="aj-typing-dot size-1.5 rounded-full bg-aj-violet" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex min-h-[40px] flex-wrap items-center gap-2 border-t border-aj-line pt-4">
        {OUTCOMES.map(({ icon: Icon, label }, i) => (
          <motion.span
            key={`${run}-${label}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.5, delay: done ? i * 0.12 : 0, ease: [0.16, 1, 0.3, 1] }}
            className="aj-chip"
          >
            <Icon size={15} weight="duotone" />
            {label}
          </motion.span>
        ))}
        {done && !reduce && (
          <button
            type="button"
            onClick={replay}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-aj-slate transition-colors hover:bg-aj-mist hover:text-aj-ink"
          >
            <ArrowCounterClockwiseIcon size={14} weight="bold" />
            Replay call
          </button>
        )}
      </div>
    </div>
  );
}

export function CallSection() {
  return (
    <section id="calls" aria-labelledby="calls-h" className="relative scroll-mt-20 overflow-x-clip">
      <div aria-hidden className="aj-glow left-[-10%] top-[10%] h-[520px] w-[620px] bg-[radial-gradient(closest-side,#ebe5ff,transparent)]" />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-5 pb-24 pt-10 sm:px-8 md:pb-32 md:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="order-2 lg:order-1">
          <CallCard />
          <p className="mt-4 text-center text-[13px] text-aj-slate">Example call. Business, names and numbers are illustrative.</p>
        </div>
        <div className="order-1 lg:order-2">
          <Heading id="calls-h" lead="Janice handles every call" payoff="so you never miss an opportunity." size="md" />
          <p className="mt-6 max-w-[34rem] text-[17.5px] leading-[1.65] text-aj-slate">
            When you’re on a job, in a meeting or done for the day, calls still come in. Janice answers every one, takes
            the right details, books the appointment and transfers the calls that need a real person.
          </p>
          <CheckList
            className="mt-8"
            items={[
              "Answers 24/7 in a natural voice, trained on your services and pricing",
              "Books straight into Google Calendar or Outlook during the call",
              "Transfers urgent calls to you, with voicemail fallback",
              "Every call logged with an AI summary, full transcript and recording",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
