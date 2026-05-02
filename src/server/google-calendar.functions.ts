import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAuthUrl, getRedirectUri, signState } from "./google-calendar.server";
import { bookAppointment } from "./widget-booking-tools";
import { resyncReceptionistById } from "./elevenlabs-agent-resync.server";

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
      const state = signState({
        user_id: auth.userId,
        agent_id: data.agent_id,
        redirect_uri: redirectUri,
      });
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

    // Tear down voice booking tools + refresh prompt now that calendar is gone.
    await resyncReceptionistById(data.agent_id).catch((e: unknown) => {
      console.error("resync after disconnect failed:", e);
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

export const updateCalendarSettings = createServerFn({ method: "POST" })
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
      .from("agent_google_calendar")
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

export const createManualBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        agent_id: z.string().uuid(),
        start_iso: z.string().min(1),
        duration_minutes: z.number().int().min(5).max(480),
        customer_name: z.string().min(1).max(200),
        customer_email: z.string().email(),
        customer_phone: z.string().max(50).optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const auth = await getAuthenticatedUserId(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    // Verify the agent belongs to this user
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, user_id")
      .eq("id", data.agent_id)
      .maybeSingle();
    if (!agent || agent.user_id !== auth.userId) {
      return { success: false as const, error: "Agent not found" };
    }

    const result = await bookAppointment({
      agentId: data.agent_id,
      userId: auth.userId,
      conversationId: null,
      source: "manual",
      args: {
        start_iso: data.start_iso,
        duration_minutes: data.duration_minutes,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        reason: data.reason,
      },
    });

    if ("error" in result) return { success: false as const, error: result.error };
    return { success: true as const, booking_id: result.booking_id, event_link: result.event_link };
  });
