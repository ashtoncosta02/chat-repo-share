import { describe, expect, it } from "vitest";
import { callMaxSeconds, AI_CALL_MAX_SECONDS, DIALER_CALL_MAX_SECONDS } from "./call-length";

describe("callMaxSeconds", () => {
  it("lets an Elite AI call run 30 minutes when plenty of minutes are left", () => {
    expect(callMaxSeconds(600, AI_CALL_MAX_SECONDS, { capSeconds: 45000, usedSeconds: 3000 })).toBe(1800);
  });
  it("lets an owner dialer call run up to 4 hours when minutes are left", () => {
    expect(callMaxSeconds(600, DIALER_CALL_MAX_SECONDS, { capSeconds: 45000, usedSeconds: 3000 })).toBe(14400);
  });
  it("limits an Essential call to the minutes that are left", () => {
    // 200 min plan, 185 min used including this call's 10-minute slot -> 15 min left + 10 min slot
    expect(callMaxSeconds(600, AI_CALL_MAX_SECONDS, { capSeconds: 12000, usedSeconds: 11100 })).toBe(1500);
  });
  it("uses the small slot when that is all the account had left", () => {
    expect(callMaxSeconds(240, DIALER_CALL_MAX_SECONDS, null)).toBe(240);
  });
  it("does not cut the call short when the usage lookup fails", () => {
    expect(callMaxSeconds(600, AI_CALL_MAX_SECONDS, null)).toBe(1800);
  });
  it("never goes below the reserved slot", () => {
    expect(callMaxSeconds(600, AI_CALL_MAX_SECONDS, { capSeconds: 12000, usedSeconds: 13000 })).toBe(600);
  });
});
