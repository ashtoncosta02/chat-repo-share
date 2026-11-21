/**
 * Twilio phone-number SIDs are "PN" + 32 hex characters. Anything else is
 * refused before we call Twilio with the account's credentials.
 */
export function isTwilioNumberSid(sid: unknown): sid is string {
  return typeof sid === "string" && /^PN[0-9a-fA-F]{32}$/.test(sid);
}

/** Compare two phone numbers by digits only (ignores +, spaces, dashes). */
export function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = (a ?? "").replace(/\D/g, "");
  const db = (b ?? "").replace(/\D/g, "");
  return da.length >= 10 && da === db;
}
