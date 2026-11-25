import { describe, expect, it } from "vitest";
import { drawRoundedBar, type RoundedBarContext } from "./canvas-bar";

type Call = [string, ...number[]];

function fakeCtx(withRoundRect: boolean): { calls: Call[]; ctx: RoundedBarContext } {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: number[]) => {
      calls.push([name, ...args]);
    };
  const base = {
    moveTo: record("moveTo"),
    arcTo: record("arcTo"),
    closePath: record("closePath"),
  };
  const ctx = (
    withRoundRect
      ? { ...base, roundRect: record("roundRect") }
      : base
  ) as unknown as RoundedBarContext;
  return { calls, ctx };
}

describe("drawRoundedBar", () => {
  it("uses ctx.roundRect when the browser has it", () => {
    const { calls, ctx } = fakeCtx(true);
    drawRoundedBar(ctx, 10, 20, 3.2, 40, 1.6);
    expect(calls).toEqual([["roundRect", 10, 20, 3.2, 40, 1.6]]);
  });

  it("falls back to arcTo when ctx.roundRect is missing (older Safari)", () => {
    const { calls, ctx } = fakeCtx(false);
    expect(() => drawRoundedBar(ctx, 10, 20, 3.2, 40, 1.6)).not.toThrow();
    expect(calls.some((c) => c[0] === "roundRect")).toBe(false);
    expect(calls[0][0]).toBe("moveTo");
    expect(calls.filter((c) => c[0] === "arcTo")).toHaveLength(4);
    expect(calls[calls.length - 1][0]).toBe("closePath");
  });

  it("never lets the fallback radius exceed half the bar", () => {
    const { calls, ctx } = fakeCtx(false);
    drawRoundedBar(ctx, 0, 0, 3.2, 40, 99);
    const radii = calls.filter((c) => c[0] === "arcTo").map((c) => c[5]);
    expect(radii.every((r) => r <= 1.6)).toBe(true);
  });
});
