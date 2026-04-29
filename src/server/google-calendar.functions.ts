import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAuthUrl, getRedirectUri, signState } from "./google-calendar.server";

async function getAuthenticatedUserId(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return { error: "Unauthorized. Please sign in again." as const };
  }
  return { userId: data.user.id };
}

// Returns the Google OAuth URL the client should redirect to.
export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), agent_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const auth = await getAuthenticatedUserId(data.accessToken);
      if ("error" in auth) return { success: false as const, error: auth.error };

      const request = getRequest();
      const redirectUri = getRedirectUri(request);
      const state = signState({ user_id: auth.userId, agent_id: data.agent_id });
      const url = buildAuthUrl(redirectUri, state);
      return { success: true as const, url };
    } catch (e) {
      console.error("startGoogleCalendarConnect", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Failed to start Google connect",
      };
    }
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), agent_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { error } = await supabaseAdmin
      .from("agent_google_calendar")
      .delete()
      .eq("agent_id", data.agent_id)
      .eq("user_id", auth.userId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });
