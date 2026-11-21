import { describe, expect, it } from "vitest";
import { decideContactProof, textMentionsNumber } from "./contact-proof";

describe("decideContactProof", () => {
  it("verifies when the provider shows any real call or text", () => {
    expect(decideContactProof(["no", "yes"])).toBe("verified");
    expect(decideContactProof(["error", "yes"])).toBe("verified");
  });
  it("refuses a number that never contacted the business", () => {
    expect(decideContactProof(["no", "no"])).toBe("unverified");
  });
  it("refuses when the business has no numbers to check", () => {
    expect(decideContactProof([])).toBe("unverified");
  });
  it("reports an error instead of guessing when a lookup failed", () => {
    expect(decideContactProof(["no", "error"])).toBe("error");
  });
});

describe("textMentionsNumber", () => {
  const n = "+15551234567";
  it("finds a number a visitor typed in common formats", () => {
    expect(textMentionsNumber("call me at (555) 123-4567 please", n)).toBe(true);
    expect(textMentionsNumber("555.123.4567", n)).toBe(true);
    expect(textMentionsNumber("my cell: +1 555 123 4567", n)).toBe(true);
    expect(textMentionsNumber("5551234567", n)).toBe(true);
    expect(textMentionsNumber("15551234567", n)).toBe(true);
  });
  it("accepts a saved lead number that is not in +1 format", () => {
    expect(textMentionsNumber("+1 555 123 4567", "(555) 123-4567")).toBe(true);
  });
  it("does not match a different number", () => {
    expect(textMentionsNumber("call 555-123-4568", n)).toBe(false);
    expect(textMentionsNumber("no number here, just 4567", n)).toBe(false);
  });
  it("does not match inside a longer digit string", () => {
    expect(textMentionsNumber("order 99555123456712", n)).toBe(false);
  });
});
