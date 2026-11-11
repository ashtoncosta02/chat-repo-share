import { describe, expect, it } from "vitest";
import { isMissedInitiatedCall } from "./initiated-caller";

const now = 1_800_000_000;
const base = { status: "initiated", direction: "inbound", start_time_unix_secs: now - 20 * 60 };

describe("isMissedInitiatedCall", () => {
  it("counts an initiated inbound call older than 15 minutes and under 7 days", () => {
    expect(isMissedInitiatedCall(base, now)).toBe(true);
    expect(isMissedInitiatedCall({ ...base, start_time_unix_secs: now - 6 * 86400 }, now)).toBe(true);
  });
  it("skips a call that finished normally", () => {
    expect(isMissedInitiatedCall({ ...base, status: "done" }, now)).toBe(false);
  });
  it("skips an outbound call", () => {
    expect(isMissedInitiatedCall({ ...base, direction: "outbound" }, now)).toBe(false);
  });
  it("skips a call that started 15 minutes ago or less", () => {
    expect(isMissedInitiatedCall({ ...base, start_time_unix_secs: now - 10 * 60 }, now)).toBe(false);
    expect(isMissedInitiatedCall({ ...base, start_time_unix_secs: now - 15 * 60 }, now)).toBe(false);
  });
  it("skips a call 7 days old or older", () => {
    expect(isMissedInitiatedCall({ ...base, start_time_unix_secs: now - 7 * 86400 }, now)).toBe(false);
    expect(isMissedInitiatedCall({ ...base, start_time_unix_secs: now - 8 * 86400 }, now)).toBe(false);
  });
});
