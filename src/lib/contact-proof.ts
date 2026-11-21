/**
 * Outbound-call destination rule.
 *
 * Lead phone numbers can be typed or edited by the account owner (and by website
 * visitors), so a saved lead number alone never proves who it belongs to. Before
 * the app places any outbound call (AI call-back or click-to-call bridge) it asks
 * the phone provider whether that number has actually phoned or texted one of the
 * business's own numbers, or whether a visitor typed it in the business's
 * website chat. Both records are written only by our server (owners can read
 * chat messages but not add or change them), so editing a lead proves nothing.
 */
export type ContactCheck = "yes" | "no" | "error";
export type ContactProof = "verified" | "unverified" | "error";

/** Combine per-number provider lookups: any real contact wins; otherwise a failed lookup is an error. */
export function decideContactProof(checks: ReadonlyArray<ContactCheck>): ContactProof {
  if (checks.includes("yes")) return "verified";
  if (checks.includes("error")) return "error";
  return "unverified";
}

/**
 * True when `text` contains `e164` written in any common format
 * ("(555) 123-4567", "555.123.4567", "+1 555 123 4567", "15551234567").
 * Each run of digits and separators is compared whole, so a number is never
 * matched inside a longer digit string.
 */
export function textMentionsNumber(text: string, e164: string): boolean {
  const raw = e164.replace(/\D/g, "");
  const target = raw.length === 10 ? `1${raw}` : raw;
  if (target.length < 7) return false;
  const runs = text.match(/\+?\d[\d\s().-]*\d/g) ?? [];
  for (const run of runs) {
    const digits = run.replace(/\D/g, "");
    if (digits === target) return true;
    if (target.length === 11 && target.startsWith("1") && digits === target.slice(1)) return true;
  }
  return false;
}

export const UNVERIFIED_CONTACT_MESSAGE =
  "For safety, the app only calls people who have phoned or texted your business number, or typed their number in your website chat. Please call this customer from your own phone instead.";

export const CONTACT_CHECK_FAILED_MESSAGE =
  "Couldn't confirm this customer with your phone provider right now. Please try again in a minute.";
