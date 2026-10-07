import { motion, useReducedMotion } from "motion/react";
import { CalendarCheckIcon, ChatCircleTextIcon, PhoneDisconnectIcon, PhoneIcon, PhoneOutgoingIcon } from "@phosphor-icons/react";
import { JaniceMark } from "@/janice/components/Logo";
import { CheckList, Heading } from "@/janice/components/ui";

const EASE = [0.16, 1, 0.3, 1] as const;

const THREADS = [
  { icon: CalendarCheckIcon, name: "Megan Torres", status: "Booked: Thursday 10:00 AM", time: "2:14 PM", tone: "violet" },
  { icon: ChatCircleTextIcon, name: "Mike R.", status: "Lead captured: call back requested", time: "11:02 AM", tone: "violet", callback: true },
  { icon: PhoneDisconnectIcon, name: "Unknown caller", status: "Hung up before speaking", time: "Yesterday", tone: "muted" },
];

function InboxVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[520px] pt-[92px]">
      {/* Arriving alert */}
      <motion.div
        className="absolute inset-x-4 top-0 z-[2] flex items-start gap-3 rounded-[22px] bg-aj-paper/95 p-4 shadow-[inset_0_0_0_1px_var(--color-aj-line),0_24px_50px_-20px_rgb(53_34_106/0.45)] backdrop-blur sm:inset-x-8"
        initial={reduce ? false : { opacity: 0, y: -28, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
      >
        <JaniceMark size={36} className="shrink-0" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-aj-ink">
            Janice <span className="text-[12px] font-normal text-aj-slate">now</span>
          </p>
          <p className="mt-0.5 text-[13.5px] leading-[1.45] text-aj-slate">
            New lead from Mike. Asked about a bathroom quote and requested a call back.
          </p>
        </div>
      </motion.div>

      <div className="aj-card-lift overflow-hidden">
        <div className="flex items-center justify-between border-b border-aj-line px-5 py-4">
          <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-aj-ink">Leads</p>
          <p className="text-[12.5px] text-aj-slate">Calls and chats</p>
        </div>
        <ul className="divide-y divide-aj-line">
          {THREADS.map(({ icon: Icon, name, status, time, tone, callback }, i) => (
            <motion.li
              key={name}
              className="flex items-center gap-3.5 px-5 py-4"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.12 }}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tone === "violet" ? "bg-aj-lavender text-aj-violet-ink" : "bg-aj-mist text-aj-slate"}`}>
                <Icon size={19} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-aj-ink">{name}</p>
                <p className="truncate text-[13px] text-aj-slate">{status}</p>
              </div>
              {callback ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-aj-violet px-3 py-1.5 text-[12.5px] font-semibold text-aj-plum">
                  <PhoneOutgoingIcon size={14} weight="bold" />
                  Call back
                </span>
              ) : (
                <span className="text-[12.5px] text-aj-slate">{time}</span>
              )}
            </motion.li>
          ))}
        </ul>
        <div className="flex items-center gap-2 bg-aj-haze px-5 py-3.5 text-[12.5px] text-aj-slate">
          <PhoneIcon size={14} weight="duotone" className="text-aj-violet-ink" />
          Summary, transcript and recording saved on every thread
        </div>
      </div>
    </div>
  );
}

export function InboxSection() {
  return (
    <section id="inbox" aria-labelledby="inbox-h" className="relative scroll-mt-20 overflow-x-clip">
      <div aria-hidden className="aj-glow right-[-12%] top-[20%] h-[520px] w-[640px] bg-[radial-gradient(closest-side,#ece7ff,transparent)]" />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="order-2 lg:order-1">
          <InboxVisual />
          <p className="mt-4 text-center text-[13px] text-aj-slate">Example leads. Names are illustrative.</p>
        </div>
        <div className="order-1 lg:order-2">
          <Heading id="inbox-h" lead="You’re always in the loop," payoff="even when you’re not at your desk." size="md" />
          <p className="mt-6 max-w-[34rem] text-[17.5px] leading-[1.65] text-aj-slate">
            Handing off your phone doesn’t mean losing control. The moment a call or chat ends, you get the summary,
            the transcript and an alert wherever you need it.
          </p>
          <CheckList
            className="mt-8"
            items={[
              "Instant email and SMS alerts the second a conversation ends",
              "Every thread in one dashboard, calls and website chats together",
              "Optional SMS follow-up sent to the customer automatically",
              "One-click callback straight from your leads list",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
