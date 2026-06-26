import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const archiveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; archived: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.conversationId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const blockCaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string; agentId?: string | null; reason?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const phone = (data.phone || "").trim();
    if (!phone) throw new Error("Phone is required.");
    const { error } = await context.supabase.from("blocked_callers").upsert(
      {
        user_id: context.userId,
        phone,
        agent_id: data.agentId ?? null,
        reason: data.reason ?? null,
      },
      { onConflict: "user_id,phone" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unblockCaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("blocked_callers")
      .delete()
      .eq("user_id", context.userId)
      .eq("phone", data.phone);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBlockedCallers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blocked_callers")
      .select("id, phone, reason, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
