import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAuthUrl,
  getRedirectUri,
  refreshAccessToken,
  signState,
} from "@/server/outlook-calendar.server";

async function getAuthenticatedUserId(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return { error: "Unauthorized. Please sign in again." as const };
  }
  return { userId: data.user.id };
}

export const startOutlookCalendarConnect = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), agent_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const auth = await getAuthenticatedUserId(data.accessToken);
      if ("error" in auth) return { success: false as const, error: auth.error };

      const request = getRequest();
      const redirectUri = getRedirectUri(request);
      const state = signState({
        user_id: auth.userId,
        agent_id: data.agent_id,
        redirect_uri: redirectUri,
      });
      const url = buildAuthUrl(redirectUri, state);
      return { success: true as const, url };
    } catch (e) {
      console.error("startOutlookCalendarConnect", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Failed to start Outlook connect",
      };
    }
  });

export const disconnectOutlookCalendar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), agent_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { error } = await supabaseAdmin
      .from("agent_outlook_calendar")
      .delete()
      .eq("agent_id", data.agent_id)
      .eq("user_id", auth.userId);
    if (error) return { success: false as const, error: error.message };

    const { resyncReceptionistById } = await import("@/server/elevenlabs-agent-resync.server");
    await resyncReceptionistById(data.agent_id).catch((e: unknown) => {
      console.error("resync after outlook disconnect failed:", e);
    });

    return { success: true as const };
  });

const dayHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/),
});

const businessHoursSchema = z.object({
  sunday: dayHoursSchema,
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
});

export const updateOutlookCalendarSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        agent_id: z.string().uuid(),
        timezone: z.string().min(1).max(64),
        default_event_duration_minutes: z.number().int().min(5).max(480),
        booking_buffer_minutes: z.number().int().min(0).max(240),
        business_hours: businessHoursSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { error } = await supabaseAdmin
      .from("agent_outlook_calendar")
      .update({
        timezone: data.timezone,
        default_event_duration_minutes: data.default_event_duration_minutes,
        booking_buffer_minutes: data.booking_buffer_minutes,
        business_hours: data.business_hours,
      })
      .eq("agent_id", data.agent_id)
      .eq("user_id", auth.userId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

export const getOutlookCalendarHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), agent_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { status: "error" as const, error: auth.error };

    const { data: row, error } = await supabaseAdmin
      .from("agent_outlook_calendar")
      .select("access_token, refresh_token, token_expires_at, microsoft_account_email")
      .eq("agent_id", data.agent_id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (error) return { status: "error" as const, error: error.message };
    if (!row) return { status: "not_connected" as const };

    const expiresAt = new Date(row.token_expires_at).getTime();
    if (Date.now() < expiresAt - 60_000) {
      return { status: "ok" as const, email: row.microsoft_account_email };
    }

    try {
      const refreshed = await refreshAccessToken(row.refresh_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("agent_outlook_calendar")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || row.refresh_token,
          token_expires_at: newExpiresAt,
          last_refresh_error: null,
        })
        .eq("agent_id", data.agent_id)
        .eq("user_id", auth.userId);
      return { status: "ok" as const, email: row.microsoft_account_email };
    } catch (e) {
      console.error("getOutlookCalendarHealth refresh failed", e);
      return {
        status: "needs_reconnect" as const,
        email: row.microsoft_account_email,
        reason: e instanceof Error ? e.message : "Refresh failed",
      };
    }
  });
