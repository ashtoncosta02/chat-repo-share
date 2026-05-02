import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resyncReceptionistById } from "./elevenlabs-agent-resync.server";

const SyncInput = z.object({
  accessToken: z.string().min(1),
  agentId: z.string().uuid(),
});

async function authUser(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized." as const };
  return { userId: data.user.id };
}

/**
 * Create the EL agent if missing, otherwise update it in place so prompt
 * + voice + FAQs always match what's in our DB.
 */
export const syncReceptionistAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SyncInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    // Verify ownership before touching EL.
    const { data: owned } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("id", data.agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!owned) return { success: false as const, error: "Receptionist not found." };

    const result = await resyncReceptionistById(data.agentId);
    if (!result.success) return { success: false as const, error: result.error };
    return { success: true as const, elevenlabs_agent_id: result.elevenlabs_agent_id };
  });

const TokenInput = z.object({
  accessToken: z.string().min(1),
  agentId: z.string().uuid(),
});

/** Returns a short-lived WebRTC conversation token for the browser preview. */
export const getReceptionistPreviewToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getConversationToken, getConversationSignedUrl } = await import(
      "./elevenlabs-agent.server"
    );
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: row } = await supabaseAdmin
      .from("agents")
      .select("id, elevenlabs_agent_id")
      .eq("id", data.agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!row?.elevenlabs_agent_id) {
      return {
        success: false as const,
        error: "Voice agent not provisioned yet. Save your settings first.",
      };
    }
    try {
      const [token, signedUrl] = await Promise.all([
        getConversationToken(row.elevenlabs_agent_id).catch(() => null),
        getConversationSignedUrl(row.elevenlabs_agent_id).catch(() => null),
      ]);
      if (!token && !signedUrl) {
        return { success: false as const, error: "Could not get preview credentials." };
      }
      return {
        success: true as const,
        token: token ?? "",
        signedUrl: signedUrl ?? "",
        agentId: row.elevenlabs_agent_id,
      };
    } catch (e) {
      console.error("getReceptionistPreviewToken error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not get preview token.",
      };
    }
  });

// Phone-to-EL linking happens via the platform owner uploading Twilio
// account creds in the ElevenLabs dashboard. Once imported there, EL handles
// inbound calls automatically.

const DeleteInput = z.object({
  accessToken: z.string().min(1),
  agentId: z.string().uuid(),
});

/** Removes the EL agent for this receptionist (called before DB delete). */
export const deleteReceptionistAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteBookingToolsForAgent, deleteElevenLabsAgent } = await import(
      "./elevenlabs-agent.server"
    );
    const auth = await authUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    // Always try to clean up booking tools first (independent of agent existence).
    await deleteBookingToolsForAgent(data.agentId).catch((e: unknown) => {
      console.error("deleteBookingToolsForAgent error:", e);
    });

    const { data: row } = await supabaseAdmin
      .from("agents")
      .select("elevenlabs_agent_id")
      .eq("id", data.agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!row?.elevenlabs_agent_id) return { success: true as const };
    try {
      await deleteElevenLabsAgent(row.elevenlabs_agent_id);
      return { success: true as const };
    } catch (e) {
      console.error("deleteReceptionistAgent error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Could not delete voice agent.",
      };
    }
  });
