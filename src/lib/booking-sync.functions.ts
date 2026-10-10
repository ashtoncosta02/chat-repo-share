import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Removes bookings whose event was deleted (or cancelled) directly in the
 * owner's Google / Outlook calendar. Only rows owned by the caller are checked.
 * If the calendar can't be reached, nothing is removed.
 */
export const syncBookingsWithCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const Google = await import("@/server/google-calendar.server");
    const Outlook = await import("@/server/outlook-calendar.server");

    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("calendar_bookings")
      .select("id, agent_id, provider, google_event_id, outlook_event_id")
      .eq("user_id", context.userId)
      .gte("ends_at", since)
      .limit(150);
    if (!rows?.length) return { removed: 0 };

    const tokenCache = new Map<string, { token: string; calendar_id: string } | null>();
    const getToken = async (provider: string, agentId: string) => {
      const key = `${provider}:${agentId}`;
      if (!tokenCache.has(key)) {
        const t =
          provider === "outlook"
            ? await Outlook.getValidAccessToken(agentId)
            : await Google.getValidAccessToken(agentId);
        tokenCache.set(key, t);
      }
      return tokenCache.get(key)!;
    };

    const gone: string[] = [];
    await Promise.all(
      rows.map(async (r) => {
        try {
          if (r.provider === "outlook" && r.outlook_event_id) {
            const conn = await getToken("outlook", r.agent_id);
            if (!conn) return;
            const res = await fetch(
              `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(r.outlook_event_id)}?$select=id,isCancelled`,
              { headers: { Authorization: `Bearer ${conn.token}` } },
            );
            if (res.status === 404 || res.status === 410) gone.push(r.id);
            else if (res.ok) {
              const j = (await res.json()) as { isCancelled?: boolean };
              if (j.isCancelled) gone.push(r.id);
            }
          } else if (r.google_event_id) {
            const conn = await getToken("google", r.agent_id);
            if (!conn) return;
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(r.google_event_id)}?fields=status`,
              { headers: { Authorization: `Bearer ${conn.token}` } },
            );
            if (res.status === 404 || res.status === 410) gone.push(r.id);
            else if (res.ok) {
              const j = (await res.json()) as { status?: string };
              if (j.status === "cancelled") gone.push(r.id);
            }
          }
        } catch (e) {
          console.error("booking sync check failed", r.id, e);
        }
      }),
    );

    if (gone.length) {
      await supabaseAdmin
        .from("calendar_bookings")
        .delete()
        .in("id", gone)
        .eq("user_id", context.userId);
    }
    return { removed: gone.length };
  });
