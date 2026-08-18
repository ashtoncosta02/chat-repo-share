import { useEffect, useState } from "react";
import { useReveal } from "@/hooks/useReveal";

const stats = [
  { value: 24, suffix: "/7", label: "Always answering, even after hours" },
  { value: 2, suffix: "s", label: "Average time to pick up a call" },
  { value: 100, suffix: "%", label: "Of calls transcribed and saved as leads" },
  { value: 30, suffix: " days", label: "Money-back guarantee" },
];

export function StatBand() {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section className="mx-auto max-w-6xl px-6">
      <div
        ref={ref}
        className="grid gap-8 rounded-3xl border border-border bg-card px-8 py-10 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((s, i) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-4xl font-bold text-gold">
              <CountUp to={s.value} run={visible} delay={i * 120} />
              {s.suffix}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CountUp({ to, run, delay }: { to: number; run: boolean; delay: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(to);
      return;
    }
    let frame = 0;
    let raf = 0;
    const total = 45;
    const start = window.setTimeout(() => {
      const tick = () => {
        frame += 1;
        const p = Math.min(frame / total, 1);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [run, to, delay]);

  return <>{value}</>;
}
