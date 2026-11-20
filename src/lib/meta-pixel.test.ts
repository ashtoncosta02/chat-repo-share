import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPixelPath, resetPixelStateForTests, setPixelActive, trackConversion } from "./meta-pixel";

type Call = unknown[];
let calls: Call[];

beforeEach(() => {
  resetPixelStateForTests();
  calls = [];
  const fbq = Object.assign((...args: unknown[]) => calls.push(args), { queue: [], loaded: true, version: "2.0" });
  vi.stubGlobal("window", { fbq });
});
afterEach(() => vi.unstubAllGlobals());

const pageViews = () => calls.filter((c) => c[0] === "track" && c[1] === "PageView").length;

describe("Meta Pixel page views", () => {
  it("first load sends exactly one PageView, and each page change one more", () => {
    setPixelActive(true, false);
    setPixelActive(true, false); // consent re-check on the same page
    expect(pageViews()).toBe(1);
    setPixelActive(true, true);
    expect(pageViews()).toBe(2);
  });

  it("the chat widget and dashboard pages never get the Pixel", () => {
    expect(isPixelPath("/widget/abc")).toBe(false);
    expect(isPixelPath("/dashboard")).toBe(false);
    expect(isPixelPath("/dashboard/leads")).toBe(false);
    expect(isPixelPath("/pricing")).toBe(true);
    expect(isPixelPath("/")).toBe(true);
  });

  it("a conversion on a paused dashboard page sends no PageView and pauses again", () => {
    trackConversion("StartTrial", { content_name: "essential_monthly", currency: "USD" }, "cs_test_1");
    expect(pageViews()).toBe(0);
    expect(calls.map((c) => c[0] + ":" + String(c[1]))).toEqual([
      "init:1910459309922815",
      "track:StartTrial",
      "consent:revoke",
    ]);
  });
});
