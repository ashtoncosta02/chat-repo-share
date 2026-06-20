import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mark an ElevenLabs conversation ID as originating from the dashboard
 * "Live voice test". The post-call webhook checks this table and skips
 * persisting the conversation to Threads.
 */
export const markConversationAsDashboardTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { elevenlabsConversationId: string }) => {
    if (!input?.elevenlabsConversationId || typeof input.elevenlabsConversationId !== "string") {
      throw new Error("elevenlabsConversationId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("dashboard_test_conversations")
      .insert({
        user_id: userId,
        elevenlabs_conversation_id: data.elevenlabsConversationId,
      });
    if (error && !error.message.includes("duplicate")) {
      console.error("markConversationAsDashboardTest failed:", error);
      return { success: false as const, error: error.message };
    }
    return { success: true as const };
  });
