import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Verify an access token belongs to a signed-in admin. */
export async function requireAdminUser(
  accessToken: string,
): Promise<{ userId: string } | { error: "Unauthorized" | "Forbidden" }> {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return { error: "Unauthorized" };
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { error: "Forbidden" };
  return { userId: data.user.id };
}
