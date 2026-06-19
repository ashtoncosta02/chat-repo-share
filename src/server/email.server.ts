// Resend email sender via Lovable connector gateway.
// Server-only: never import from client/route component code.
// Both secrets (LOVABLE_API_KEY, RESEND_API_KEY) are managed and always
// present in the server runtime.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";

export const DEFAULT_FROM = "Janice <hello@send.askjanice.net>";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

/**
 * Send an email through Resend. Returns the provider message id on success,
 * or null on failure. Never throws — email failures must not break the
 * surrounding business flow (a booking is still valid even if the email
 * doesn't go out).
 */
export async function sendEmail(params: SendEmailParams): Promise<string | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.error("sendEmail: missing LOVABLE_API_KEY or RESEND_API_KEY");
    return null;
  }

  const toArr = Array.isArray(params.to) ? params.to : [params.to];
  const cleanTo = toArr.map((t) => t.trim()).filter(Boolean);
  if (cleanTo.length === 0) {
    console.warn("sendEmail: no recipients");
    return null;
  }

  const body: Record<string, unknown> = {
    from: params.from ?? DEFAULT_FROM,
    to: cleanTo,
    subject: params.subject,
    html: params.html,
  };
  if (params.text) body.text = params.text;
  if (params.replyTo) body.reply_to = params.replyTo;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`sendEmail: Resend ${res.status} — ${text.slice(0, 500)}`);
      return null;
    }
    try {
      const json = JSON.parse(text) as { id?: string };
      return json.id ?? null;
    } catch {
      return null;
    }
  } catch (e) {
    console.error("sendEmail: fetch failed", e);
    return null;
  }
}
