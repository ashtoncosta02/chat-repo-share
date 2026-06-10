import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.LOVABLE_API_KEY;
  if (!s) throw new Error("LOVABLE_API_KEY is not configured");
  return s;
}

export function signPayload(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function verifyPayload(payload: string, sig: string): boolean {
  const expected = signPayload(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
