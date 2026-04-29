import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAuthUrl, getRedirectUri, signState } from "./google-calendar.server";

// Returns the Google OAuth URL the client should redirect to.
export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ agent_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const request = getRequest();
      const redirectUri = getRedirectUri(request);
      const state = signState({ user_id: context.userId, agent_id: data.agent_id });
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ agent_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_google_calendar")
      .delete()
      .eq("agent_id", data.agent_id);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });
