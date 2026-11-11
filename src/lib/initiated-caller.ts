// Pure helper: an inbound caller who hung up before the receptionist answered.
// ElevenLabs leaves such conversations at status "initiated" with no audio and
// never sends a post-call report, so the sweep saves the caller as a lead.
export const INITIATED_MIN_AGE_SECS = 15 * 60;
export const INITIATED_MAX_AGE_SECS = 7 * 86400;

/** List-level check (status + age window), done before fetching the detail. */
export function isInitiatedInWindow(
  item: { status?: string | null; start_time_unix_secs?: number | null },
  nowSec: number,
): boolean {
  if (item.status !== "initiated") return false;
  const start = item.start_time_unix_secs;
  if (typeof start !== "number" || !Number.isFinite(start) || start <= 0) return false;
  const age = nowSec - start;
  return age > INITIATED_MIN_AGE_SECS && age < INITIATED_MAX_AGE_SECS;
}

/** Full check: initiated, in the age window, and an inbound phone call. */
export function isMissedInitiatedCall(
  call: { status?: string | null; start_time_unix_secs?: number | null; direction?: string | null },
  nowSec: number,
): boolean {
  return isInitiatedInWindow(call, nowSec) && call.direction === "inbound";
}
