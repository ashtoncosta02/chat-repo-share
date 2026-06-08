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
      phonesRes,
      gcalListRes,
      lastVoiceRes,
      lastWidgetRes,
    ] = await Promise.all([
      supabaseAdmin.from("agents").select("user_id, business_name, is_live, onboarding_completed, elevenlabs_agent_id").in("user_id", userIds),
      supabaseAdmin.from("widget_conversations").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("conversations").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("calendar_bookings").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("leads").select("user_id").in("user_id", userIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabaseAdmin.from("phone_numbers").select("user_id, elevenlabs_phone_number_id").in("user_id", userIds),
      supabaseAdmin.from("agent_google_calendar").select("user_id, token_expires_at").in("user_id", userIds),
      supabaseAdmin.from("conversations").select("user_id, started_at").in("user_id", userIds).order("started_at", { ascending: false }),
      supabaseAdmin.from("widget_conversations").select("user_id, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
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
    const phoneCounts = tally(phonesRes.data);

    const phoneUnlinked = new Map<string, number>();
    (phonesRes.data ?? []).forEach((p) => {
      if (!p.elevenlabs_phone_number_id) phoneUnlinked.set(p.user_id, (phoneUnlinked.get(p.user_id) ?? 0) + 1);
    });

    const gcalByUser = new Map<string, { expired: boolean }>();
    const now = Date.now();
    (gcalListRes.data ?? []).forEach((g) => {
      gcalByUser.set(g.user_id, { expired: new Date(g.token_expires_at).getTime() < now });
    });

    const lastActivity = new Map<string, string>();
    (lastVoiceRes.data ?? []).forEach((r) => {
      const prev = lastActivity.get(r.user_id);
      if (!prev || r.started_at > prev) lastActivity.set(r.user_id, r.started_at);
    });
    (lastWidgetRes.data ?? []).forEach((r) => {
      const prev = lastActivity.get(r.user_id);
      if (!prev || r.created_at > prev) lastActivity.set(r.user_id, r.created_at);
    });

    const agentByUser = new Map<string, { business_name: string; is_live: boolean; onboarding_completed: boolean; elevenlabs_agent_id: string | null }>();
    (agentsRes.data ?? []).forEach((a) => agentByUser.set(a.user_id, a));

    const adminSet = new Set<string>();
    (rolesRes.data ?? []).forEach((r) => {
      if (r.role === "admin") adminSet.add(r.user_id);
    });

    const users = profiles.map((p) => {
      const agent = agentByUser.get(p.user_id) ?? null;
      const phones = phoneCounts.get(p.user_id) ?? 0;
      const unlinked = phoneUnlinked.get(p.user_id) ?? 0;
      const gcal = gcalByUser.get(p.user_id) ?? null;
      const issues: string[] = [];
      if (!agent) issues.push("No receptionist");
      else {
        if (!agent.onboarding_completed) issues.push("Onboarding incomplete");
        if (!agent.elevenlabs_agent_id) issues.push("Voice not linked");
      }
      if (phones === 0) issues.push("No phone number");
      else if (unlinked > 0) issues.push(`${unlinked} number(s) not connected to AI`);
      if (gcal?.expired) issues.push("Calendar token expired");

      const status: "healthy" | "warning" | "inactive" = (() => {
        if (issues.length > 0) return "warning";
        const last = lastActivity.get(p.user_id);
        if (last && Date.now() - new Date(last).getTime() > 30 * 86400000) return "inactive";
        if (!last && Date.now() - new Date(p.created_at).getTime() > 7 * 86400000) return "inactive";
        return "healthy";
      })();

      return {
        user_id: p.user_id,
        email: p.email,
        display_name: p.display_name,
        created_at: p.created_at,
        is_admin: adminSet.has(p.user_id),
        agent,
        widget_conversations: widgetCounts.get(p.user_id) ?? 0,
        voice_conversations: voiceCounts.get(p.user_id) ?? 0,
        bookings: bookingCounts.get(p.user_id) ?? 0,
        leads: leadCounts.get(p.user_id) ?? 0,
        phones,
        last_activity_at: lastActivity.get(p.user_id) ?? null,
        issues,
        status,
      };
    });

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

const userIdSchema = z.object({ accessToken: z.string().min(1), userId: z.string().uuid() });

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => userIdSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const uid = data.userId;
    const [
      profileRes,
      agentRes,
      phonesRes,
      gcalRes,
      voiceConvosRes,
      widgetConvosRes,
      bookingsRes,
      leadsRes,
      roleRes,
      authUserRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("agents").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("phone_numbers").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabaseAdmin.from("agent_google_calendar").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("conversations").select("id, elevenlabs_conversation_id, started_at, ended_at, duration_seconds, message_count, ai_summary, recording_url").eq("user_id", uid).order("started_at", { ascending: false }).limit(20),
      supabaseAdmin.from("widget_conversations").select("id, visitor_name, visitor_email, page_url, created_at, updated_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("calendar_bookings").select("id, customer_name, customer_email, starts_at, ends_at, status, source, google_event_link, created_at").eq("user_id", uid).order("starts_at", { ascending: false }).limit(20),
      supabaseAdmin.from("leads").select("id, name, phone, email, source, status, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin.auth.admin.getUserById(uid),
    ]);

    const gcal = gcalRes.data;
    const tokenExpired = gcal ? new Date(gcal.token_expires_at).getTime() < Date.now() : false;
    const missingTranscripts = (voiceConvosRes.data ?? []).filter((c) => !c.ai_summary && c.ended_at).length;

    const agent = agentRes.data;
    const phones = phonesRes.data ?? [];
    const healthIssues: string[] = [];
    if (!agent) healthIssues.push("No receptionist created");
    else {
      if (!agent.onboarding_completed) healthIssues.push("Onboarding incomplete");
      if (!agent.elevenlabs_agent_id) healthIssues.push("Voice agent not linked to ElevenLabs");
      if (!agent.is_live) healthIssues.push("Receptionist is in draft (not live)");
    }
    if (phones.length === 0) healthIssues.push("No phone number");
    else {
      const unlinked = phones.filter((p) => !p.elevenlabs_phone_number_id);
      if (unlinked.length) healthIssues.push(`${unlinked.length} phone number(s) not connected to AI`);
    }
    if (gcal && tokenExpired) healthIssues.push("Google Calendar token expired — reconnect needed");
    if (missingTranscripts > 0) healthIssues.push(`${missingTranscripts} recent call(s) missing transcript`);

    return {
      success: true as const,
      profile: profileRes.data,
      authUser: authUserRes.data?.user ? {
        last_sign_in_at: authUserRes.data.user.last_sign_in_at,
        email_confirmed_at: authUserRes.data.user.email_confirmed_at,
        created_at: authUserRes.data.user.created_at,
      } : null,
      isAdmin: (roleRes.data ?? []).some((r) => r.role === "admin"),
      agent,
      phones,
      googleCalendar: gcal ? { ...gcal, access_token: undefined, refresh_token: undefined, token_expired: tokenExpired } : null,
      voiceConversations: voiceConvosRes.data ?? [],
      widgetConversations: widgetConvosRes.data ?? [],
      bookings: bookingsRes.data ?? [],
      leads: leadsRes.data ?? [],
      healthIssues,
    };
  });

export const getSystemHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const now = Date.now();

    const [
      voiceCalls24h,
      voiceCalls7d,
      widgetConvos24h,
      bookings24h,
      bookings7d,
      agentsLinked,
      phonesLinkedRes,
      phonesTotalRes,
      gcalRes,
      agentsTotal,
      agentsLive,
      onboardingIncomplete,
    ] = await Promise.all([
      supabaseAdmin.from("conversations").select("id, duration_seconds, ai_summary, ended_at, started_at").gte("started_at", oneDayAgo),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", sevenDaysAgo),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }).not("elevenlabs_agent_id", "is", null),
      supabaseAdmin.from("phone_numbers").select("id", { count: "exact", head: true }).not("elevenlabs_phone_number_id", "is", null),
      supabaseAdmin.from("phone_numbers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("agent_google_calendar").select("user_id, token_expires_at"),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }).eq("is_live", true),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }).eq("onboarding_completed", false),
    ]);

    const calls = voiceCalls24h.data ?? [];
    const completed = calls.filter((c) => c.ended_at).length;
    const missingTranscripts = calls.filter((c) => c.ended_at && !c.ai_summary).length;
    const avgDuration = completed > 0
      ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / completed)
      : 0;

    const gcalRows = gcalRes.data ?? [];
    const gcalExpired = gcalRows.filter((g) => new Date(g.token_expires_at).getTime() < now).length;

    return {
      success: true as const,
      voice: {
        calls24h: calls.length,
        calls7d: voiceCalls7d.count ?? 0,
        completed,
        missingTranscripts,
        avgDurationSecs: avgDuration,
      },
      widget: {
        conversations24h: widgetConvos24h.count ?? 0,
      },
      bookings: {
        last24h: bookings24h.count ?? 0,
        last7d: bookings7d.count ?? 0,
      },
      integrations: {
        elevenLabsLinked: agentsLinked.count ?? 0,
        phonesLinked: phonesLinkedRes.count ?? 0,
        phonesTotal: phonesTotalRes.count ?? 0,
        googleCalendarConnected: gcalRows.length,
        googleCalendarExpired: gcalExpired,
      },
      agents: {
        total: agentsTotal.count ?? 0,
        live: agentsLive.count ?? 0,
        onboardingIncomplete: onboardingIncomplete.count ?? 0,
      },
    };
  });

export const adminBackfillUserCalls = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => userIdSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { backfillRecentCalls } = await import("@/server/voice-call-backfill.server");
    const { data: agents } = await supabaseAdmin
      .from("agents")
      .select("elevenlabs_agent_id")
      .eq("user_id", data.userId);
    const linked = (agents ?? []).filter((a) => a.elevenlabs_agent_id);
    if (linked.length === 0) return { success: false as const, error: "No linked voice agent." };

    let saved = 0, skipped = 0, errors = 0, scanned = 0;
    for (const a of linked) {
      try {
        const r = await backfillRecentCalls({ elAgentId: a.elevenlabs_agent_id! });
        scanned += r.scanned; saved += r.saved; skipped += r.skipped; errors += r.errors;
      } catch (e) {
        errors++; console.error(e);
      }
    }
    return { success: true as const, scanned, saved, skipped, errors };
  });
