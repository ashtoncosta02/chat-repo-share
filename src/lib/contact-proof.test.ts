import { describe, expect, it } from "vitest";
import { decideContactProof } from "./contact-proof";

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
