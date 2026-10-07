import { useState } from "react";
import { HammerIcon, ScalesIcon, ScissorsIcon, StethoscopeIcon } from "@phosphor-icons/react";
import { Heading, Reveal } from "@/janice/components/ui";

const AUDIENCES = [
  {
    key: "trades",
    icon: HammerIcon,
    title: "Trades & home services",
    body: "You’re on a ladder, not by the phone. Janice quotes, qualifies and books the site visit.",
    alt: "A tradesman on a ladder fitting a light while his phone rings on the counter below",
    pos: "50% 30%",
  },
  {
    key: "clinic",
    icon: StethoscopeIcon,
    title: "Clinics & practices",
    body: "Front desk overflow, after-hours calls and appointment requests, handled without hold music.",
    alt: "A physiotherapist treating a patient while the front desk phone rings",
    pos: "45% 40%",
  },
  {
    key: "salon",
    icon: ScissorsIcon,
    title: "Salons & studios",
    body: "Every booking request answered mid-appointment, so walk-in revenue never rings out.",
    alt: "A stylist mid-cut while his phone lights up with a call on the station",
    pos: "40% 35%",
  },
  {
    key: "legal",
    icon: ScalesIcon,
    title: "Legal & consulting",
    body: "New enquiries screened, details captured and consultations scheduled, 24 hours a day.",
    alt: "A lawyer in a client meeting with her phone ringing on the table",
    pos: "60% 40%",
  },
];

function Photo({ k, alt, pos, eager = false }: { k: string; alt: string; pos: string; eager?: boolean }) {
  return (
    <img
      src={`/img/aud-${k}-1200.webp`}
      srcSet={`/img/aud-${k}-640.webp 640w, /img/aud-${k}-1200.webp 1200w`}
      sizes="(min-width: 1024px) 560px, 80vw"
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={1200}
      height={1607}
      className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-aj-expo)] group-hover:scale-[1.03]"
      style={{ objectPosition: pos }}
    />
  );
}

export function AudienceSection() {
  const [active, setActive] = useState(0);
  return (
    <section aria-labelledby="who-h" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 md:py-32">
        <Reveal className="max-w-[44rem]">
          <Heading id="who-h" lead="Built for busy" payoff="local businesses." />
          <p className="mt-5 max-w-[34rem] text-[17.5px] leading-[1.65] text-aj-slate">
            If your hands are full when the phone rings, Janice was made for you.
          </p>
        </Reveal>

        {/* Desktop: expanding panels. Hover, focus or tap a panel to open it. */}
        <Reveal variant="clip" className="mt-14 hidden h-[540px] gap-3 md:flex">
          {AUDIENCES.map((a, i) => {
            const open = i === active;
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                type="button"
                aria-expanded={open}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className="group relative min-w-0 overflow-hidden rounded-[var(--radius-aj-card)] text-left shadow-[var(--shadow-aj-card)] transition-[flex-grow] duration-700 ease-[var(--ease-aj-expo)]"
                style={{ flexGrow: open ? 3.4 : 1, flexBasis: 0 }}
              >
                <Photo k={a.key} alt={a.alt} pos={a.pos} />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(23_24_45/0)_35%,rgb(23_24_45/0.78)_100%)]" />
                <span className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-white/90 text-aj-violet-ink backdrop-blur">
                    <Icon size={20} weight="duotone" />
                  </span>
                  <span className="font-display text-[20px] font-bold leading-[1.15] tracking-[-0.02em] text-white">{a.title}</span>
                  <span
                    className={`max-w-[26rem] text-[15px] leading-[1.55] text-white/90 transition-all duration-500 ${open ? "translate-y-0 opacity-100" : "pointer-events-none h-0 translate-y-2 opacity-0"}`}
                  >
                    {a.body}
                  </span>
                </span>
              </button>
            );
          })}
        </Reveal>

        {/* Mobile: swipeable cards. */}
        <ul className="-mx-5 mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:hidden">
          {AUDIENCES.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.key} className="group relative h-[440px] w-[80%] shrink-0 snap-center overflow-hidden rounded-[var(--radius-aj-card)] shadow-[var(--shadow-aj-card)]">
                <Photo k={a.key} alt={a.alt} pos={a.pos} />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(23_24_45/0)_30%,rgb(23_24_45/0.8)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <span className="grid size-9 place-items-center rounded-full bg-white/90 text-aj-violet-ink">
                    <Icon size={18} weight="duotone" />
                  </span>
                  <h3 className="mt-3 font-display text-[19px] font-bold tracking-[-0.02em] text-white">{a.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-[1.5] text-white/90">{a.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
