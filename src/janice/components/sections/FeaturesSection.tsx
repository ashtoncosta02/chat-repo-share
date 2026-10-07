import { useEffect, useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowsClockwiseIcon,
  ChartLineUpIcon,
  ChatsCircleIcon,
  FileTextIcon,
  InfinityIcon,
  PhoneOutgoingIcon,
  RobotIcon,
  RocketLaunchIcon,
  SirenIcon,
  UserCirclePlusIcon,
} from "@phosphor-icons/react";
import { Heading, Reveal } from "@/janice/components/ui";

/** Janice’s voice: a canvas waveform that only animates while on screen. */
function Waveform() {
  const ref = useRef<HTMLCanvasElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const reduce = useReducedMotion();

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let start = -1;
    const draw = (t: number) => {
      if (start < 0) start = t;
      // Speak for ~9s per visit, then rest on a still frame (no endless decorative loop).
      const resting = t - start > 9000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const bars = Math.floor(w / 7);
      const s = t / 1000;
      for (let i = 0; i < bars; i++) {
        const x = i / (bars - 1);
        const env = Math.pow(Math.sin(Math.PI * x), 0.9);
        // Speech-like: syllable bursts over a slow phrase envelope.
        const phrase = 0.55 + 0.45 * Math.sin(s * 1.3 + x * 3.1);
        const syll = Math.abs(Math.sin(s * 6.2 + i * 0.55) * Math.cos(s * 2.3 + i * 0.21));
        const amp = reduce || resting ? 0.3 + 0.45 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) : 0.12 + 0.88 * syll * phrase;
        const bh = Math.max(4, env * amp * h * 0.92);
        ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * env})`;
        const bx = i * 7;
        const r = 1.6;
        ctx.beginPath();
        ctx.roundRect(bx, (h - bh) / 2, 3.2, bh, r);
        ctx.fill();
      }
      if (!reduce && inView && !resting) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce]);

  return <canvas ref={ref} aria-hidden className="h-[96px] w-full" />;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const BUSY: Record<string, number[]> = { Mon: [0, 2], Tue: [1], Wed: [0, 3], Thu: [2], Fri: [1, 3] };

function MiniCalendar() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="grid grid-cols-5 gap-1.5">
      {DAYS.map((d) => (
        <div key={d} className="flex flex-col gap-1.5">
          <span className="text-center text-[11px] font-medium text-aj-slate">{d}</span>
          {[0, 1, 2, 3].map((r) => {
            const busy = BUSY[d].includes(r);
            const booked = d === "Thu" && r === 0;
            if (booked)
              return (
                <motion.span
                  key={r}
                  className="relative grid h-9 place-items-center overflow-hidden rounded-lg bg-aj-violet text-[10.5px] font-semibold leading-none text-aj-plum shadow-[0_8px_18px_-8px_rgb(136_107_238/0.9)]"
                  initial={reduce ? false : { opacity: 0, y: -14, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.5 }}
                >
                  10:00
                </motion.span>
              );
            return <span key={r} className={`h-9 rounded-lg ${busy ? "bg-aj-lavender" : "bg-aj-paper shadow-[inset_0_0_0_1px_var(--color-aj-line-soft)]"}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

const GROUPS = [
  {
    title: "Calls",
    items: [
      { icon: RobotIcon, text: "1 AI receptionist trained on your business" },
      { icon: InfinityIcon, text: "Unlimited calls, 24/7" },
      { icon: SirenIcon, text: "Instant human transfer for emergencies" },
    ],
  },
  {
    title: "Leads",
    items: [
      { icon: UserCirclePlusIcon, text: "Lead capture: name, phone and email saved automatically" },
      { icon: FileTextIcon, text: "Full conversation transcripts" },
      { icon: ChartLineUpIcon, text: "Analytics: call volume, peak hours, leads" },
      { icon: PhoneOutgoingIcon, text: "One-click callback from your leads dashboard" },
    ],
  },
  {
    title: "Follow-up",
    items: [
      { icon: ArrowsClockwiseIcon, text: "SMS follow-up after every call (optional)" },
      { icon: ChatsCircleIcon, text: "Live chat widget for your website" },
      { icon: RocketLaunchIcon, text: "Full setup included, ready in minutes" },
    ],
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-h" className="relative scroll-mt-20">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 md:py-32">
        <Reveal className="max-w-[40rem]">
          <Heading id="features-h" lead="Everything included." payoff="No add-ons." />
          <p className="mt-5 text-[17.5px] leading-[1.65] text-aj-slate">One plan, one price, every feature switched on from day one.</p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-12">
          <Reveal className="md:col-span-7" variant="scale">
            <div className="relative flex h-full min-h-[360px] flex-col justify-between overflow-hidden rounded-[var(--radius-aj-card)] bg-[linear-gradient(150deg,#6447d6_0%,#5a3dcc_55%,#4a2db6_100%)] p-8 text-white shadow-[var(--shadow-aj-lift)] sm:p-10">
              <div aria-hidden className="aj-glow -bottom-28 -right-16 h-[300px] w-[300px] bg-[radial-gradient(closest-side,rgb(196_178_255/0.45),transparent)]" />
              <div className="relative">
                <h3 className="max-w-[22rem] font-display text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">
                  A receptionist who sounds human
                </h3>
                <p className="mt-4 max-w-[30rem] text-[16px] leading-[1.6] text-white">
                  Natural voice, your greeting, your tone. Janice handles questions about your services, hours and pricing,
                  screens the call, and transfers to you the moment it’s urgent.
                </p>
              </div>
              <div className="relative mt-10">
                <Waveform />
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/18 px-3 py-1.5 text-[12.5px] font-semibold text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                  Janice speaking
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-5" variant="scale" delay={0.08}>
            <div className="aj-card flex h-full flex-col justify-between gap-8 p-8 sm:p-9">
              <div>
                <h3 className="font-display text-[24px] font-bold leading-[1.15] tracking-[-0.03em] text-aj-ink">Books straight into your calendar</h3>
                <p className="mt-3 text-[15.5px] leading-[1.6] text-aj-slate">
                  Google Calendar and Outlook, with your real business hours. Janice offers open slots on the call and the
                  appointment is on your calendar before you hang up.
                </p>
              </div>
              <MiniCalendar />
            </div>
          </Reveal>

          <Reveal className="md:col-span-12" variant="scale" delay={0.12}>
            <div className="rounded-[var(--radius-aj-card)] bg-aj-mist p-8 shadow-[inset_0_0_0_1px_var(--color-aj-line-soft)] sm:p-10">
              <div className="grid gap-10 md:grid-cols-3 md:gap-8">
                {GROUPS.map((g) => (
                  <div key={g.title}>
                    <h3 className="font-display text-[18px] font-bold tracking-[-0.02em] text-aj-ink">{g.title}</h3>
                    <ul className="mt-5 grid gap-4">
                      {g.items.map(({ icon: Icon, text }) => (
                        <li key={text} className="flex gap-3 text-[15px] leading-[1.5] text-aj-ink/85">
                          <Icon size={20} weight="duotone" className="mt-[1px] shrink-0 text-aj-violet-ink" />
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
