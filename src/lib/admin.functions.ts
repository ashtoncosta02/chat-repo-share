import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return { error: "Unauthorized" as const };
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { error: "Forbidden" as const };
  return { userId: data.user.id };
}

const tokenSchema = z.object({ accessToken: z.string().min(1) });

export const getAdminOverview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      profilesCount,
      newProfiles7d,
      agentsTotal,
      agentsLive,
      widgetConvos,
      widgetConvos30d,
      voiceConvos,
      voiceConvos30d,
      bookingsTotal,
      bookingsUpcoming,
      leadsTotal,
      newLeads7d,
      phoneNumbersTotal,
      gcalConnected,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }).eq("is_live", true),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", thirtyDaysAgo),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }).gte("starts_at", new Date().toISOString()),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("phone_numbers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("agent_google_calendar").select("id", { count: "exact", head: true }),
    ]);

    const { data: recentSignups } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      success: true as const,
      stats: {
        users: {
          total: profilesCount.count ?? 0,
          new7d: newProfiles7d.count ?? 0,
        },
        agents: {
          total: agentsTotal.count ?? 0,
          live: agentsLive.count ?? 0,
        },
        widgetConversations: {
          total: widgetConvos.count ?? 0,
          last30d: widgetConvos30d.count ?? 0,
        },
        voiceConversations: {
          total: voiceConvos.count ?? 0,
          last30d: voiceConvos30d.count ?? 0,
        },
        bookings: {
          total: bookingsTotal.count ?? 0,
          upcoming: bookingsUpcoming.count ?? 0,
        },
        leads: {
          total: leadsTotal.count ?? 0,
          new7d: newLeads7d.count ?? 0,
        },
        phoneNumbers: phoneNumbersTotal.count ?? 0,
        calendarsConnected: gcalConnected.count ?? 0,
      },
      recentSignups: recentSignups ?? [],
    };
  });

export const getAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name, created_at")
      .order("created_at", { ascending: false });

    if (!profiles || profiles.length === 0) {
      return { success: true as const, users: [] };
    }

    const userIds = profiles.map((p) => p.user_id);

    const [
      agentsRes,
      widgetRes,
      voiceRes,
      bookingsRes,
      leadsRes,
      rolesRes,
    ] = await Promise.all([
      supabaseAdmin.from("agents").select("user_id, business_name, is_live, onboarding_completed").in("user_id", userIds),
      supabaseAdmin.from("widget_conversations").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("conversations").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("calendar_bookings").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("leads").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds),
    ]);

    const tally = (rows: { user_id: string }[] | null) => {
      const m = new Map<string, number>();
      (rows ?? []).forEach((r) => m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1));
      return m;
    };

    const widgetCounts = tally(widgetRes.data);
    const voiceCounts = tally(voiceRes.data);
    const bookingCounts = tally(bookingsRes.data);
    const leadCounts = tally(leadsRes.data);

    const agentByUser = new Map<string, { business_name: string; is_live: boolean; onboarding_completed: boolean }>();
    (agentsRes.data ?? []).forEach((a) => agentByUser.set(a.user_id, a));

    const adminSet = new Set<string>();
    (rolesRes.data ?? []).forEach((r) => {
      if (r.role === "admin") adminSet.add(r.user_id);
    });

    const users = profiles.map((p) => ({
      user_id: p.user_id,
      email: p.email,
      display_name: p.display_name,
      created_at: p.created_at,
      is_admin: adminSet.has(p.user_id),
      agent: agentByUser.get(p.user_id) ?? null,
      widget_conversations: widgetCounts.get(p.user_id) ?? 0,
      voice_conversations: voiceCounts.get(p.user_id) ?? 0,
      bookings: bookingCounts.get(p.user_id) ?? 0,
      leads: leadCounts.get(p.user_id) ?? 0,
    }));

    return { success: true as const, users };
  });

export const checkIsAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: userData, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !userData.user) return { isAdmin: false };
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!roleRow };
  });
