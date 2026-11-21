/**
 * Outbound-call destination rule.
 *
 * Lead phone numbers can be typed or edited by the account owner (and by website
 * visitors), so a saved lead number alone never proves who it belongs to. Before
 * the app places any outbound call (AI call-back or click-to-call bridge) it asks
 * the phone provider whether that number has actually phoned or texted one of the
 * business's own numbers. Only the provider's records count.
 */
export type ContactCheck = "yes" | "no" | "error";
export type ContactProof = "verified" | "unverified" | "error";

/** Combine per-number provider lookups: any real contact wins; otherwise a failed lookup is an error. */
export function decideContactProof(checks: ReadonlyArray<ContactCheck>): ContactProof {
  if (checks.includes("yes")) return "verified";
  if (checks.includes("error")) return "error";
  return "unverified";
}

export const UNVERIFIED_CONTACT_MESSAGE =
  "For safety, the app only calls people who have phoned or texted your business number. Please call this customer from your own phone instead.";

export const CONTACT_CHECK_FAILED_MESSAGE =
  "Couldn't confirm this customer with your phone provider right now. Please try again in a minute.";
