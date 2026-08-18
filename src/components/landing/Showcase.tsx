import { Check, PhoneIncoming, MessageCircle, BellRing } from "lucide-react";
import { Reveal } from "./Reveal";

function Bubble({ from, children }: { from: "agent" | "caller"; children: string }) {
  return (
    <div className={`flex ${from === "caller" ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${
          from === "caller"
            ? "bg-[var(--gold)] text-[var(--primary-foreground)]"
            : "bg-secondary text-foreground"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

function CallMock() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
      <div className="bg-[var(--gold)] px-5 py-4 text-[var(--primary-foreground)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">Summary</p>
        <p className="mt-1.5 text-sm leading-snug">
          Called asking about pricing for a kitchen remodel. Booked an on-site quote for Thursday
          at 10:00 AM.
        </p>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[1.15fr_1fr]">
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Conversation · Call
          </p>
          <Bubble from="agent">Thanks for calling Janice — how can I help you today?</Bubble>
          <Bubble from="caller">Hi, do you guys do full kitchen remodels?</Bubble>
          <Bubble from="agent">
            We do. I can get you on the calendar for a quote — Thursday at 10 works.
          </Bubble>
          <Bubble from="caller">Thursday at 10 is perfect. Megan Torres.</Bubble>
          <Bubble from="agent">
            You're all set, Megan. I've texted you the details and added it to the calendar.
          </Bubble>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Info
          </p>
          <ul className="space-y-1.5 text-[13px] text-foreground">
            <li>Today, 2:14 PM</li>
            <li>Megan Torres</li>
            <li>(970) 555-0148</li>
          </ul>
          <div className="rounded-2xl border border-border bg-secondary/50 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">
              Appointment created
            </p>
            <p className="mt-2 text-[13px] font-medium">Thursday @ 10:00 AM</p>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              On-site visit for a kitchen remodel quote.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WidgetMock() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-3 flex-1 truncate rounded-full bg-background px-3 py-1 text-[11px] text-muted-foreground">
          yourwebsite.com
        </span>
      </div>
      <div className="relative p-5">
        <div className="space-y-2 opacity-60">
          <div className="h-6 w-2/3 rounded bg-secondary" />
          <div className="h-3 w-full rounded bg-secondary" />
          <div className="h-3 w-5/6 rounded bg-secondary" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="h-16 rounded-xl bg-secondary" />
            <div className="h-16 rounded-xl bg-secondary" />
            <div className="h-16 rounded-xl bg-secondary" />
          </div>
        </div>
        <div className="mt-5 ml-auto w-full max-w-[19rem] overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          <div className="bg-[var(--gold)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)]">
            Janice
          </div>
          <div className="space-y-2.5 p-4">
            <Bubble from="caller">Are you guys open on Saturdays?</Bubble>
            <Bubble from="agent">
              We are, 9 to 3. Want me to hold a spot? I just need your name and number.
            </Bubble>
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-[12px] text-muted-foreground">
              Type your message…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotifyMock() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.4)]">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--gold)] text-[var(--primary-foreground)]">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Janice · 2m ago</p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              New lead from Mike. Asked about a bathroom quote and requested a call back.
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Threads
        </div>
        <ul className="divide-y divide-border">
          {[
            { name: "Megan Torres", meta: "Booked · Thursday 10:00 AM", time: "2:14 PM" },
            { name: "Mike R.", meta: "Lead captured · Call back requested", time: "11:02 AM" },
            { name: "Unknown caller", meta: "Hung up before speaking", time: "Yesterday" },
          ].map((t) => (
            <li key={t.name} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-gold-foreground">
                <PhoneIncoming className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate text-[12px] text-muted-foreground">{t.meta}</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{t.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const blocks = [
  {
    icon: PhoneIncoming,
    eyebrow: "Call answering and appointment booking",
    title: "Janice handles every call",
    highlight: "so you never miss an opportunity",
    body: [
      "When you're on a job, in a meeting, or just done for the day, calls still come in.",
      "Janice answers every one, takes the right information, books the appointment, and transfers the calls that need a real person.",
    ],
    points: [
      "Answers 24/7 in a natural voice, trained on your services and pricing",
      "Books straight into Google Calendar or Outlook during the call",
      "Transfers urgent calls to you, with voicemail fallback",
      "Every call logged with an AI summary, full transcript and recording",
    ],
    mock: <CallMock />,
    flip: false,
  },
  {
    icon: MessageCircle,
    eyebrow: "Website chat and lead capture",
    title: "Janice works on your website.",
    highlight: "No added cost.",
    body: [
      "Leads don't just come from phone calls. Janice answers questions, captures contact info, and books appointments right on your site using the same knowledge she has from your phone setup.",
    ],
    points: [
      "Live chat bot included in your plan — nothing extra to buy",
      "Answers visitor questions instantly, day or night",
      "Captures name, phone and email without a phone call",
      "One line of code to install — no developer needed",
    ],
    mock: <WidgetMock />,
    flip: true,
  },
  {
    icon: BellRing,
    eyebrow: "Notifications and your inbox",
    title: "You're always in the loop",
    highlight: "even when you're not at your desk",
    body: [
      "Handing off your phone doesn't mean losing control. The moment a call or chat ends, you get the summary, the transcript, and a notification wherever you need it.",
    ],
    points: [
      "Instant email and SMS alerts the second a conversation ends",
      "Every thread in one dashboard — calls and website chats together",
      "Optional SMS follow-up sent to the customer automatically",
      "One-click callback straight from your leads list",
    ],
    mock: <NotifyMock />,
    flip: false,
  },
];

export function Showcase() {
  return (
    <section id="how-janice-works" className="scroll-mt-24 bg-secondary/30 py-24">
      <div className="mx-auto max-w-6xl space-y-24 px-6">
        {blocks.map((b) => (
          <div
            key={b.eyebrow}
            className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16"
          >
            <Reveal className={b.flip ? "lg:order-2" : ""}>{b.mock}</Reveal>

            <Reveal delay={120} className={b.flip ? "lg:order-1" : ""}>
              <div className="flex items-center gap-2 text-gold">
                <b.icon className="h-5 w-5" />
                <p className="text-sm font-semibold">{b.eyebrow}</p>
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                {b.title} <span className="text-gold">{b.highlight}</span>
              </h2>
              {b.body.map((p) => (
                <p key={p} className="mt-4 text-lg leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              <ul className="mt-7 space-y-3.5">
                {b.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--primary-foreground)]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-base leading-snug text-foreground">{pt}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}
