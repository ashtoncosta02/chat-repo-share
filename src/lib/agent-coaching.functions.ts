import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitAgentFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    agentId: string;
    conversationId?: string | null;
    rating: "up" | "down" | "note";
    note?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const note = (data.note ?? "").trim().slice(0, 2000) || null;
    const { data: row, error } = await supabase
      .from("agent_feedback")
      .insert({
        agent_id: data.agentId,
        user_id: userId,
        conversation_id: data.conversationId ?? null,
        rating: data.rating,
        note,
      })
      .select("id")
      .single();
    if (error) return { success: false as const, error: error.message };

    // Auto-apply: kick a resync so the receptionist picks up the new coaching
    // note on the next call. Fire-and-forget so the UI stays snappy.
    if (data.rating === "down" && note) {
      try {
        const { resyncReceptionistById } = await import(
          "@/server/elevenlabs-agent-resync.server"
        );
        resyncReceptionistById(data.agentId).catch(() => {});
      } catch {
        // ignore
      }
    }
    return { success: true as const, id: row.id };
  });

export const listAgentFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("agent_feedback")
      .select("id, rating, note, conversation_id, created_at")
      .eq("agent_id", data.agentId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { success: false as const, error: error.message, rows: [] };
    return { success: true as const, rows: rows ?? [] };
  });

export const getConversationFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("agent_feedback")
      .select("id, rating, note, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false });
    if (error) return { success: false as const, error: error.message, rows: [] };
    return { success: true as const, rows: rows ?? [] };
  });

export const deleteAgentFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; agentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("agent_feedback")
      .delete()
      .eq("id", data.id);
    if (error) return { success: false as const, error: error.message };
    try {
      const { resyncReceptionistById } = await import(
        "@/server/elevenlabs-agent-resync.server"
      );
      resyncReceptionistById(data.agentId).catch(() => {});
    } catch {
      // ignore
    }
    return { success: true as const };
  });
