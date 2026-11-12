/**
 * Click-to-call safety rules.
 *
 * The dialer may only connect the owner's own saved phone (forwarding or
 * notification number from their receptionist settings) to a customer who has
 * already contacted the business (a saved lead). Both legs therefore come from
 * data stored on the server, never from free-form text sent by the browser.
 */
export type Normalizer = (raw: string | null | undefined) => string | null;

/** True when `e164` matches one of the saved numbers after normalising both. */
export function matchesSavedNumber(
  e164: string,
  saved: ReadonlyArray<string | null | undefined>,
  normalize: Normalizer,
): boolean {
  for (const raw of saved) {
    if (raw && normalize(raw) === e164) return true;
  }
  return false;
}

export const UNKNOWN_DESTINATION_MESSAGE =
  "You can only call customers who have already contacted your business (they appear in Leads).";

export const UNKNOWN_CALLBACK_MESSAGE =
  "Your phone must be the forwarding or notification number saved in your receptionist settings.";
