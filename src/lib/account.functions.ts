import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirm: z.literal("DELETE") }).parse(input),
  )
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort cleanup of owned rows; auth.users delete cascades to most.
    await supabaseAdmin.from("agents").delete().eq("user_id", userId);
    await supabaseAdmin.from("phone_numbers").delete().eq("user_id", userId);
    await supabaseAdmin.from("agent_google_calendar").delete().eq("user_id", userId);
    await supabaseAdmin.from("agent_outlook_calendar").delete().eq("user_id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  });
