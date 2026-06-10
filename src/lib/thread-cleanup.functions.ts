import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAutoDeleteSetting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agents")
      .select("auto_delete_threads_hours")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { hours: (data?.auto_delete_threads_hours ?? null) as number | null };
  });

export const setAutoDeleteSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hours: number | null }) => {
    if (input.hours !== null && ![24, 168].includes(input.hours)) {
      throw new Error("Invalid value. Allowed: null, 24, 168.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agents")
      .update({ auto_delete_threads_hours: data.hours })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
