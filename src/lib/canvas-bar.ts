/**
 * Draw a rounded bar on a canvas.
 *
 * `CanvasRenderingContext2D.roundRect` only exists in Safari 16+ and newer
 * Chromium/Firefox. Older Safari and iPhone/iPad browsers throw
 * "roundRect is not a function" inside the requestAnimationFrame loop, which
 * leaves the waveform blank and spams the error log, so fall back to arcTo.
 */
export type RoundedBarContext = Pick<
  CanvasRenderingContext2D,
  "roundRect" | "moveTo" | "arcTo" | "closePath"
>;

export function drawRoundedBar(
  ctx: RoundedBarContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  // Capsule built from four corner arcs; radius can never exceed half the bar.
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
