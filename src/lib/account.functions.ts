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
    const { purgeAccount } = await import("@/server/account-purge.server");
    await purgeAccount(userId);
    return { success: true as const };
  });
