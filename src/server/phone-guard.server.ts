// Toll-fraud guard: only allow US/Canada (NANP) destinations, excluding
// premium/pay-per-call area codes and Caribbean NANP regions that bill at
// international rates.

/** Normalize to E.164; 10-digit numbers default to +1. Returns null if unusable. */
export function normalize(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const BLOCKED_AREA_CODES = new Set([
  "900", "976", "242", "246", "264", "268", "284", "340", "345", "441", "473",
  "649", "658", "664", "670", "671", "684", "721", "758", "767", "784", "787",
  "809", "829", "849", "868", "869", "876", "939",
]);

export function isAllowedNanp(e164: string | null | undefined): boolean {
  if (!e164) return false;
  const m = /^\+1([2-9]\d{2})([2-9]\d{6})$/.exec(e164);
  if (!m) return false;
  return !BLOCKED_AREA_CODES.has(m[1]);
}

export const DISALLOWED_NUMBER_MESSAGE =
  "Only US and Canada numbers are supported (no premium or international numbers).";
