import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { backfillRecentCalls } from "./voice-call-backfill.server";

async function getAuthenticatedUserId(
  accessToken: string,
): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user?.id) return { error: "Not authenticated" };
  return { userId: data.user.id };
}

const Input = z.object({ accessToken: z.string().min(1) });

/**
 * Pull recent completed phone calls from ElevenLabs for the signed-in user's
 * agent and save any that the post-call webhook missed.
 */
export const backfillVoiceCalls = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: agents, error } = await supabaseAdmin
      .from("agents")
      .select("id, elevenlabs_agent_id")
      .eq("user_id", auth.userId);
    if (error) return { success: false as const, error: "Could not load agents." };

    const linked = (agents ?? []).filter((a) => a.elevenlabs_agent_id);
    if (linked.length === 0) {
      return { success: false as const, error: "No voice agent connected yet." };
    }

    let saved = 0;
    let skipped = 0;
    let errors = 0;
    let scanned = 0;
    for (const a of linked) {
      try {
        const r = await backfillRecentCalls({ elAgentId: a.elevenlabs_agent_id! });
        scanned += r.scanned;
        saved += r.saved;
        skipped += r.skipped;
        errors += r.errors;
      } catch (e) {
        errors++;
        console.error("backfillVoiceCalls error:", e);
      }
    }
    return { success: true as const, scanned, saved, skipped, errors };
  });
