import { describe, expect, it } from "vitest";
import { matchesSavedNumber } from "./dialer-guard";

const normalize = (raw: string | null | undefined) => {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
};

describe("matchesSavedNumber", () => {
  it("matches a saved number written in a different format", () => {
    expect(matchesSavedNumber("+15555550123", ["(555) 555-0123"], normalize)).toBe(true);
  });
  it("rejects a number that is not saved", () => {
    expect(matchesSavedNumber("+15555550199", ["555-555-0123", null, ""], normalize)).toBe(false);
  });
  it("rejects when nothing is saved", () => {
    expect(matchesSavedNumber("+15555550123", [], normalize)).toBe(false);
  });
});
