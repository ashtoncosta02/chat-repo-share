// Full account teardown: stop billing, release paid resources, revoke
// third-party access, then delete the auth user.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function twilioGatewayHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TWILIO_API_KEY,
  };
}

/** Best effort: sign the user out everywhere. The RPC may not exist yet. */
export async function revokeUserSessions(userId: string): Promise<void> {
  try {
    const rpc = supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    const { error } = await rpc.call(supabaseAdmin, "revoke_user_sessions" as never, { p_user: userId });
    if (error) console.warn("[account] revoke_user_sessions failed:", error.message);
  } catch (e) {
    console.warn("[account] revoke_user_sessions threw:", e);
  }
}

async function bestEffort(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[account-purge] ${label} failed:`, e);
  }
}

/**
 * Throws (and deletes nothing) if any active subscription cannot be cancelled.
 * Everything after billing is best effort with logging.
 */
export async function purgeAccount(userId: string): Promise<void> {
  // (a) Cancel billing first — must succeed.
  const { data: subs, error: subsErr } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, environment, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);
  if (subsErr) throw new Error("Could not load subscriptions; nothing was deleted.");
  if (subs && subs.length > 0) {
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    for (const row of subs) {
      try {
        const stripe = createStripeClient(row.environment as "sandbox" | "live");
        await stripe.subscriptions.cancel(row.stripe_subscription_id);
      } catch (e) {
        console.error("[account-purge] subscription cancel failed", row.stripe_subscription_id, e);
        throw new Error(
          `Could not cancel the subscription, so nothing was deleted: ${getStripeErrorMessage(e)}`,
        );
      }
    }
  }

  const el = await import("@/server/elevenlabs-agent.server");

  // (b) Phone numbers: unlink from ElevenLabs, release from Twilio.
  const { data: phones } = await supabaseAdmin
    .from("phone_numbers")
    .select("id, twilio_sid, elevenlabs_phone_number_id")
    .eq("user_id", userId);
  for (const p of phones ?? []) {
    if (p.elevenlabs_phone_number_id) {
      await bestEffort(`EL phone ${p.elevenlabs_phone_number_id}`, () =>
        el.deleteElevenLabsPhoneNumber(p.elevenlabs_phone_number_id!),
      );
    }
    if (p.twilio_sid) {
      await bestEffort(`Twilio release ${p.twilio_sid}`, async () => {
        const res = await fetch(`${TWILIO_GATEWAY_URL}/IncomingPhoneNumbers/${p.twilio_sid}.json`, {
          method: "DELETE",
          headers: twilioGatewayHeaders(),
        });
        if (!res.ok && res.status !== 404) {
          throw new Error(`Twilio DELETE ${res.status}: ${await res.text()}`);
        }
      });
    }
  }

  // (c) Booking tools + ElevenLabs agent.
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("id, elevenlabs_agent_id")
    .eq("user_id", userId);
  for (const a of agents ?? []) {
    await bestEffort(`booking tools ${a.id}`, () => el.deleteBookingToolsForAgent(a.id));
    if (a.elevenlabs_agent_id) {
      await bestEffort(`EL agent ${a.elevenlabs_agent_id}`, () =>
        el.deleteElevenLabsAgent(a.elevenlabs_agent_id!),
      );
    }
  }

  // (d) Revoke Google tokens.
  const { data: googleRows } = await supabaseAdmin
    .from("agent_google_calendar")
    .select("refresh_token")
    .eq("user_id", userId);
  for (const g of googleRows ?? []) {
    if (!g.refresh_token) continue;
    await bestEffort("Google token revoke", async () => {
      const res = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: g.refresh_token }),
      });
      if (!res.ok && res.status !== 400) throw new Error(`Google revoke ${res.status}`);
    });
  }

  // (e) Call recordings.
  await bestEffort("call-audio cleanup", async () => {
    const bucket = supabaseAdmin.storage.from("call-audio");
    for (let i = 0; i < 50; i++) {
      const { data: files, error } = await bucket.list(userId, { limit: 1000 });
      if (error) throw error;
      if (!files || files.length === 0) break;
      const { error: rmErr } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
      if (rmErr) throw rmErr;
      if (files.length < 1000) break;
    }
  });

  // (f) Sessions.
  await revokeUserSessions(userId);

  // (g) Delete the auth user (cascades to owned rows).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
