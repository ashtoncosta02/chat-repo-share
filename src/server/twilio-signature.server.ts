import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify the X-Twilio-Signature header.
 * Algorithm: HMAC-SHA1 over (full URL + sorted POST params concatenated as key+value),
 * base64-encoded, using the Twilio Auth Token as the key.
 *
 * Returns true if valid OR if running locally without the auth token configured
 * (dev convenience). In production TWILIO_AUTH_TOKEN must be set.
 */
export async function verifyTwilioSignature(
  request: Request,
  formParams: Record<string, string>,
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn("TWILIO_AUTH_TOKEN not configured — skipping signature check");
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Twilio signs against the URL it called. Behind Lovable's edge the
  // forwarded host may differ; honor x-forwarded-* when present.
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) url.host = forwardedHost;
  if (forwardedProto) url.protocol = `${forwardedProto}:`;

  const sortedKeys = Object.keys(formParams).sort();
  let data = url.toString();
  for (const k of sortedKeys) data += k + formParams[k];

  const expected = createHmac("sha1", authToken).update(data).digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function formDataToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}
