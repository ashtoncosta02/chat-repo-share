import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckIcon } from "@phosphor-icons/react";

const EASE = [0.16, 1, 0.3, 1] as const;

type RevealVariant = "rise" | "scale" | "clip";

const VARIANTS: Record<RevealVariant, { from: Record<string, number | string>; to: Record<string, number | string> }> = {
  rise: { from: { opacity: 0, y: 18 }, to: { opacity: 1, y: 0 } },
  scale: { from: { opacity: 0, scale: 0.965 }, to: { opacity: 1, scale: 1 } },
  // A curtain lift for photographic panels.
  clip: {
    from: { clipPath: "inset(18% 0% 0% 0% round 28px)", opacity: 0.4 },
    to: { clipPath: "inset(0% 0% 0% 0% round 28px)", opacity: 1 },
  },
};

/** Content is visible by default; motion only adds the arrival when JS and motion are allowed. */
export function Reveal({
  children,
  className,
  delay = 0,
  y,
  as = "div",
  variant = "rise",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "li" | "header";
  variant?: RevealVariant;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  const v = VARIANTS[variant];
  const from = variant === "rise" && y !== undefined ? { ...v.from, y } : v.from;
  return (
    <Comp
      className={className}
      initial={reduce ? false : from}
      whileInView={v.to}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: variant === "clip" ? 1.1 : 0.8, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={`grid gap-3.5 ${className ?? ""}`}>
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15.5px] leading-[1.5] text-aj-ink/85">
          <span className="mt-[1px] grid size-[22px] shrink-0 place-items-center rounded-full bg-aj-violet text-aj-plum">
            <CheckIcon size={12} weight="bold" />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Section heading in the live site’s two-tone voice: statement, then the violet italic payoff. */
export function Heading({
  lead,
  payoff,
  className,
  size = "lg",
  id,
}: {
  lead: string;
  payoff?: string;
  className?: string;
  size?: "lg" | "md";
  id?: string;
}) {
  const sz = size === "lg" ? "text-[38px] sm:text-[50px] lg:text-[56px]" : "text-[34px] sm:text-[44px]";
  return (
    <h2 id={id} className={`aj-display ${sz} leading-[1.05] text-aj-ink ${className ?? ""}`}>
      {lead}
      {payoff ? (
        <>
          {" "}
          <span className="aj-payoff inline-block pb-1">{payoff}</span>
        </>
      ) : null}
    </h2>
  );
}
