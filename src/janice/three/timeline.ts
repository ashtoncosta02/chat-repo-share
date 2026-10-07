/**
 * Scroll timeline for the hero, shared by the WebGL scene and the DOM captions.
 * Values are fractions of the pinned hero's scroll distance (0 = top, 1 = released).
 */
export const T = {
  copyOut: [0.035, 0.11],
  gather: [0.06, 0.38], // the cloud drifts toward the centre line
  converge: [0.12, 0.555], // orbs swirl in (per-orb windows live inside this range)
  core: [0.32, 0.575], // the merged core grows into a sphere
  swap: 0.58, // metaballs hand over to the coin mesh
  flatten: [0.58, 0.72], // sphere presses into the coin
  center: [0.66, 0.8], // the coin travels to screen centre
  press: [0.71, 0.8], // the "j" presses out
  settle: [0.8, 0.88], // lighting flattens toward the 2D mark
  handoff: [0.865, 0.9], // canvas cross-fades to the vector mark
  dock: [0.9, 0.995], // the mark flies into the nav
  captions: [
    [0.13, 0.33],
    [0.35, 0.54],
    [0.56, 0.73],
  ],
  meet: [0.76, 0.995], // held until the mark has landed, so the release is never blank
} as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** In-out window: 0 -> 1 over the first `edge` of [a, b], holds, then 1 -> 0 over the last `edge`. */
export const windowed = (p: number, a: number, b: number, edge = 0.28) => {
  const w = (b - a) * edge;
  return Math.min(smooth(seg(p, a, a + w)), 1 - smooth(seg(p, b - w, b)));
};
