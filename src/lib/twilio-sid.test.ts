import { describe, expect, it } from "vitest";
import { isTwilioNumberSid, sameNumber } from "./twilio-sid";

describe("isTwilioNumberSid", () => {
  it("accepts a real-looking number SID", () => {
    expect(isTwilioNumberSid("PN" + "a".repeat(32))).toBe(true);
  });
  it("refuses other resources, paths and junk", () => {
    expect(isTwilioNumberSid("CA" + "a".repeat(32))).toBe(false);
    expect(isTwilioNumberSid("PN" + "a".repeat(31))).toBe(false);
    expect(isTwilioNumberSid("PN" + "a".repeat(32) + "/../x")).toBe(false);
    expect(isTwilioNumberSid(null)).toBe(false);
  });
});

describe("sameNumber", () => {
  it("matches the same number in different formats", () => {
    expect(sameNumber("+1 (555) 010-0000", "+15550100000")).toBe(true);
  });
  it("refuses different or empty numbers", () => {
    expect(sameNumber("+15550100000", "+15550100001")).toBe(false);
    expect(sameNumber("", "")).toBe(false);
  });
});
