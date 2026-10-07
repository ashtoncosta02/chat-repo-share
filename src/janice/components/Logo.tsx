import type { CSSProperties } from "react";
import { BRAND_VIOLET, J, J_PATH, WORDMARK, WORDMARK_PLUM } from "@/janice/lib/brand";

/** The disc + "j" mark, drawn from the traced geometry. The disc fills the box edge to edge. */
export function JaniceMark({ size, className, style, title }: { size?: number; className?: string; style?: CSSProperties; title?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      shapeRendering="geometricPrecision"
    >
      <circle cx="128" cy="128" r="128" fill={BRAND_VIOLET} />
      <circle cx={J.dotX} cy={J.dotY} r={J.dotR} fill="#fff" />
      <path d={J_PATH} fill="none" stroke="#fff" strokeWidth={J.stroke} strokeLinecap="round" />
    </svg>
  );
}

/** Lowercase "janice" wordmark. `height` matches the disc height of the lockup. */
export function Wordmark({ height = 28, className }: { height?: number; className?: string }) {
  const w = (WORDMARK.width / WORDMARK.height) * height;
  return (
    <svg viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} width={w} height={height} className={className} aria-hidden="true">
      <path d={WORDMARK.path} fill={WORDMARK_PLUM} fillRule="evenodd" />
    </svg>
  );
}

/** Full lockup with the live logo’s proportions: disc, 0.16 disc-height gap, wordmark. */
export function Lockup({ height = 30, className }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`} style={{ gap: height * 0.16 }}>
      <JaniceMark size={height} />
      <Wordmark height={height} />
    </span>
  );
}
