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

    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      profilesCount,
      newProfiles7d,
      newProfiles7to14d,
      agentsTotal,
      agentsLive,
      widgetConvos,
      widgetConvos30d,
      widgetConvosToday,
      widgetConvos7d,
      voiceConvos,
      voiceConvos30d,
      voiceConvosToday,
      voiceConvos7d,
      voiceFailed24h,
      bookingsTotal,
      bookingsUpcoming,
      bookings7d,
      leadsTotal,
      newLeads7d,
      phoneNumbersTotal,
      phoneNumbersThisMonth,
      gcalConnected,
      openTickets,
      ticketsClosed7d,
      voiceConvosForDuration,
      voiceConvosMonth,
      activeAgentsVoice,
      activeAgentsChat,
      onboardingCompleted,
      oldestOpenTicket,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }).eq("is_live", true),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }).gte("created_at", startOfToday),
      supabaseAdmin.from("widget_conversations").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", thirtyDaysAgo),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", startOfToday),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", sevenDaysAgo),
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", new Date(Date.now() - 86400000).toISOString()).in("status", ["failed", "error"]),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }).gte("starts_at", new Date().toISOString()),
      supabaseAdmin.from("calendar_bookings").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("phone_numbers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("phone_numbers").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
      supabaseAdmin.from("agent_google_calendar").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting"]),
      supabaseAdmin.from("tickets").select("id", { count: "exact", head: true }).eq("status", "closed").gte("updated_at", sevenDaysAgo),
      supabaseAdmin.from("conversations").select("duration_seconds").gte("started_at", sevenDaysAgo),
      supabaseAdmin.from("conversations").select("duration_seconds").gte("started_at", startOfMonth),
      supabaseAdmin.from("conversations").select("user_id").gte("started_at", sevenDaysAgo),
      supabaseAdmin.from("widget_conversations").select("user_id").gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("agents").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
      supabaseAdmin.from("tickets").select("created_at").in("status", ["open", "in_progress", "waiting"]).order("created_at", { ascending: true }).limit(1),
    ]);

    const { data: recentSignups } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const sumDuration = (rows: { duration_seconds: number | null }[] | null) =>
      (rows ?? []).reduce((acc, r) => acc + (r.duration_seconds ?? 0), 0);
    const totalSecs7d = sumDuration(voiceConvosForDuration.data as any);
    const callCount7d = (voiceConvosForDuration.data?.length ?? 0);
    const avgCallSecs = callCount7d > 0 ? Math.round(totalSecs7d / callCount7d) : 0;
    const voiceMinutesMonth = Math.round(sumDuration(voiceConvosMonth.data as any) / 60);

    const activeVoiceUserIds = new Set((activeAgentsVoice.data ?? []).map((r: any) => r.user_id));
    const activeChatUserIds = new Set((activeAgentsChat.data ?? []).map((r: any) => r.user_id));
    const activeAccounts7d = new Set([...activeVoiceUserIds, ...activeChatUserIds]).size;

    const signupsThis = newProfiles7d.count ?? 0;
    const signupsPrev = newProfiles7to14d.count ?? 0;
    const signupsDeltaPct = signupsPrev === 0
      ? (signupsThis > 0 ? 100 : 0)
      : Math.round(((signupsThis - signupsPrev) / signupsPrev) * 100);

    const totalUsers = profilesCount.count ?? 0;
    const onboardedCount = onboardingCompleted.count ?? 0;
    const activationPct = totalUsers > 0 ? Math.round((onboardedCount / totalUsers) * 100) : 0;

    const oldestTicketAgeHours = oldestOpenTicket.data && oldestOpenTicket.data[0]
      ? Math.floor((Date.now() - new Date(oldestOpenTicket.data[0].created_at).getTime()) / 3600000)
      : null;

    return {
      success: true as const,
      stats: {
        users: {
          total: totalUsers,
          new7d: signupsThis,
          deltaPct: signupsDeltaPct,
          activationPct,
        },
        agents: {
          total: agentsTotal.count ?? 0,
          live: agentsLive.count ?? 0,
          active7d: activeAccounts7d,
        },
        widgetConversations: {
          total: widgetConvos.count ?? 0,
          last30d: widgetConvos30d.count ?? 0,
          today: widgetConvosToday.count ?? 0,
          last7d: widgetConvos7d.count ?? 0,
        },
        voiceConversations: {
          total: voiceConvos.count ?? 0,
          last30d: voiceConvos30d.count ?? 0,
          today: voiceConvosToday.count ?? 0,
          last7d: voiceConvos7d.count ?? 0,
          failed24h: voiceFailed24h.count ?? 0,
          avgCallSecs,
          voiceMinutesMonth,
        },
        bookings: {
          total: bookingsTotal.count ?? 0,
          upcoming: bookingsUpcoming.count ?? 0,
          last7d: bookings7d.count ?? 0,
        },
        leads: {
          total: leadsTotal.count ?? 0,
          new7d: newLeads7d.count ?? 0,
        },
        phoneNumbers: phoneNumbersTotal.count ?? 0,
        phoneNumbersThisMonth: phoneNumbersThisMonth.count ?? 0,
        calendarsConnected: gcalConnected.count ?? 0,
        tickets: {
          open: openTickets.count ?? 0,
          closed7d: ticketsClosed7d.count ?? 0,
          oldestOpenAgeHours: oldestTicketAgeHours,
        },
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
      supabaseAdmin.from("profiles").select("user_id, email, display_name, created_at, plan").eq("user_id", uid).maybeSingle(),
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

// =========================================================================
// Global error feed — aggregate issues across all users
// =========================================================================
export const getGlobalErrorFeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const now = Date.now();

    const [
      missingTranscriptsRes,
      unlinkedPhonesRes,
      gcalAllRes,
      onboardingIncompleteRes,
      profilesRes,
      agentsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("conversations")
        .select("id, user_id, started_at, ended_at, elevenlabs_conversation_id")
        .gte("started_at", sevenDaysAgo)
        .is("ai_summary", null)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("phone_numbers")
        .select("id, user_id, phone_number, created_at")
        .is("elevenlabs_phone_number_id", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("agent_google_calendar").select("user_id, google_email, token_expires_at"),
      supabaseAdmin
        .from("agents")
        .select("user_id, business_name, created_at")
        .eq("onboarding_completed", false)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("user_id, email, display_name"),
      supabaseAdmin.from("agents").select("user_id, business_name"),
    ]);

    const profileByUser = new Map<string, { email: string | null; display_name: string | null }>();
    (profilesRes.data ?? []).forEach((p) => profileByUser.set(p.user_id, { email: p.email, display_name: p.display_name }));
    const agentByUser = new Map<string, string>();
    (agentsRes.data ?? []).forEach((a) => agentByUser.set(a.user_id, a.business_name));

    const label = (uid: string) => {
      const p = profileByUser.get(uid);
      return p?.display_name || p?.email || agentByUser.get(uid) || uid.slice(0, 8);
    };

    const errors: {
      kind: "missing_transcript" | "phone_unlinked" | "gcal_expired" | "onboarding_stuck";
      user_id: string;
      user_label: string;
      message: string;
      detail?: string;
      at: string;
    }[] = [];

    (missingTranscriptsRes.data ?? []).forEach((c) =>
      errors.push({
        kind: "missing_transcript",
        user_id: c.user_id,
        user_label: label(c.user_id),
        message: "Voice call missing transcript",
        detail: c.elevenlabs_conversation_id ?? undefined,
        at: c.ended_at ?? c.started_at,
      }),
    );

    (unlinkedPhonesRes.data ?? []).forEach((p) =>
      errors.push({
        kind: "phone_unlinked",
        user_id: p.user_id,
        user_label: label(p.user_id),
        message: "Phone number not connected to AI",
        detail: p.phone_number,
        at: p.created_at,
      }),
    );

    (gcalAllRes.data ?? []).forEach((g) => {
      if (new Date(g.token_expires_at).getTime() < now) {
        errors.push({
          kind: "gcal_expired",
          user_id: g.user_id,
          user_label: label(g.user_id),
          message: "Google Calendar token expired",
          detail: g.google_email ?? undefined,
          at: g.token_expires_at,
        });
      }
    });

    const cutoff = Date.now() - 3 * 86400000;
    (onboardingIncompleteRes.data ?? []).forEach((a) => {
      if (new Date(a.created_at).getTime() < cutoff) {
        errors.push({
          kind: "onboarding_stuck",
          user_id: a.user_id,
          user_label: label(a.user_id),
          message: "Onboarding incomplete >3 days after signup",
          detail: a.business_name,
          at: a.created_at,
        });
      }
    });

    errors.sort((a, b) => (a.at > b.at ? -1 : 1));
    return { success: true as const, errors: errors.slice(0, 100) };
  });

// =========================================================================
// Admin fix-it actions
// =========================================================================
const phoneFixSchema = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().uuid(),
});

export const adminRelinkPhone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => phoneFixSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: row } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, phone_number, agent_id, elevenlabs_phone_number_id, user_id")
      .eq("id", data.phoneNumberId)
      .maybeSingle();
    if (!row) return { success: false as const, error: "Phone not found." };
    if (row.elevenlabs_phone_number_id) return { success: true as const, alreadyLinked: true };

    let agentId = row.agent_id;
    if (!agentId) {
      const { data: agents } = await supabaseAdmin.from("agents").select("id").eq("user_id", row.user_id).limit(1);
      if (!agents?.[0]) return { success: false as const, error: "User has no receptionist." };
      agentId = agents[0].id;
      await supabaseAdmin.from("phone_numbers").update({ agent_id: agentId }).eq("id", row.id);
    }
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("elevenlabs_agent_id, business_name")
      .eq("id", agentId)
      .maybeSingle();
    if (!agent?.elevenlabs_agent_id) return { success: false as const, error: "Receptionist not linked to ElevenLabs." };

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return { success: false as const, error: "Twilio credentials missing on server." };

    try {
      const { importTwilioNumber } = await import("@/server/elevenlabs-agent.server");
      const { phone_number_id } = await importTwilioNumber({
        phoneNumber: row.phone_number,
        label: `${agent.business_name} — AI Receptionist`,
        twilioAccountSid: sid,
        twilioAuthToken: token,
        agentId: agent.elevenlabs_agent_id,
      });
      await supabaseAdmin
        .from("phone_numbers")
        .update({ elevenlabs_phone_number_id: phone_number_id })
        .eq("id", row.id);
      return { success: true as const, alreadyLinked: false };
    } catch (e: any) {
      console.error("[admin] relink phone failed", e);
      return { success: false as const, error: e?.message ?? "ElevenLabs import failed." };
    }
  });

export const adminResyncReceptionist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => userIdSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!agent) return { success: false as const, error: "User has no receptionist." };

    try {
      const { resyncReceptionistById } = await import("@/server/elevenlabs-agent-resync.server");
      const result = await resyncReceptionistById(agent.id);
      return { success: true as const, result };
    } catch (e: any) {
      console.error("[admin] resync failed", e);
      return { success: false as const, error: e?.message ?? "Resync failed." };
    }
  });

export const adminClearGoogleCalendar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => userIdSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { error } = await supabaseAdmin
      .from("agent_google_calendar")
      .delete()
      .eq("user_id", data.userId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

// =========================================================================
// Plan management
// =========================================================================
const planSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.string().uuid(),
  plan: z.enum(["free", "discounted", "standard"]),
});

export const adminSetUserPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ plan: data.plan })
      .eq("user_id", data.userId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

// Per-user billing overrides (price override + free-until date).
// No charges happen yet — these fields will be honored when Stripe is wired up.
const billingSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.string().uuid(),
  monthly_price_override_cents: z.number().int().min(0).max(1_000_000).nullable(),
  first_month_free_until: z.string().nullable(), // ISO date or null
});

export const adminSetUserBilling = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => billingSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        monthly_price_override_cents: data.monthly_price_override_cents,
        first_month_free_until: data.first_month_free_until,
      })
      .eq("user_id", data.userId);
    if (error) return { success: false as const, error: error.message };
    console.log(`[admin] ${auth.userId} updated billing for ${data.userId}`);
    return { success: true as const };
  });

// =========================================================================
// Edit-on-behalf: admin patches a customer's receptionist / profile
// =========================================================================
const agentPatchSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.string().uuid(),
  patch: z.object({
    business_name: z.string().max(200).optional(),
    industry: z.string().max(200).optional(),
    system_prompt: z.string().max(20000).optional(),
    greeting: z.string().max(2000).optional(),
    services_text: z.string().max(20000).optional(),
    faqs_text: z.string().max(20000).optional(),
    notify_email: z.string().max(200).optional(),
    notify_phone: z.string().max(50).optional(),
    sms_followup_enabled: z.boolean().optional(),
    is_live: z.boolean().optional(),
    answer_mode: z.string().max(50).optional(),
    voice_id: z.string().max(100).optional(),
    tone: z.string().max(100).optional(),
    primary_goal: z.string().max(500).optional(),
    booking_link: z.string().max(500).optional(),
    emergency_number: z.string().max(50).optional(),
    pricing_notes: z.string().max(5000).optional(),
    escalation_triggers: z.string().max(5000).optional(),
  }),
});

export const adminUpdateAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => agentPatchSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const patch = Object.fromEntries(
      Object.entries(data.patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(patch).length === 0) {
      return { success: false as const, error: "No fields to update." };
    }

    const { error } = await supabaseAdmin
      .from("agents")
      .update(patch as any)
      .eq("user_id", data.userId);
    if (error) return { success: false as const, error: error.message };

    console.log(`[admin-edit] ${auth.userId} updated agent for ${data.userId}: ${Object.keys(patch).join(", ")}`);
    return { success: true as const, fields: Object.keys(patch) };
  });

const profilePatchSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.string().uuid(),
  patch: z.object({
    display_name: z.string().max(200).optional(),
    email: z.string().email().optional(),
  }),
});

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => profilePatchSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const patch = Object.fromEntries(
      Object.entries(data.patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(patch).length === 0) {
      return { success: false as const, error: "No fields to update." };
    }
    const { error } = await supabaseAdmin.from("profiles").update(patch as any).eq("user_id", data.userId);
    if (error) return { success: false as const, error: error.message };
    console.log(`[admin-edit] ${auth.userId} updated profile for ${data.userId}: ${Object.keys(patch).join(", ")}`);
    return { success: true as const };
  });

// =========================================================================
// Tickets (admin views)
// =========================================================================
export const getAdminTickets = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at")
      .order("created_at", { ascending: false });

    if (!tickets || tickets.length === 0) return { success: true as const, tickets: [] };
    const uids = Array.from(new Set(tickets.map((t) => t.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name")
      .in("user_id", uids);
    const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return {
      success: true as const,
      tickets: tickets.map((t) => ({
        ...t,
        user_email: map.get(t.user_id)?.email ?? null,
        user_name: map.get(t.user_id)?.display_name ?? null,
      })),
    };
  });

const ticketUpdateSchema = z.object({
  accessToken: z.string().min(1),
  ticketId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  admin_notes: z.string().optional(),
});

export const adminUpdateTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ticketUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const patch: {
      status?: "open" | "in_progress" | "waiting" | "resolved" | "closed";
      priority?: "low" | "normal" | "high" | "urgent";
      admin_notes?: string | null;
      resolved_at?: string | null;
    } = {};
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved" || data.status === "closed") patch.resolved_at = new Date().toISOString();
    }
    if (data.priority) patch.priority = data.priority;
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    const { error } = await supabaseAdmin.from("tickets").update(patch).eq("id", data.ticketId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

const ticketReplySchema = z.object({
  accessToken: z.string().min(1),
  ticketId: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

export const adminReplyTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ticketReplySchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const { error } = await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: auth.userId,
      sender_role: "admin",
      body: data.body,
    });
    if (error) return { success: false as const, error: error.message };
    // bump ticket updated_at
    await supabaseAdmin.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", data.ticketId);
    return { success: true as const };
  });

export const getAdminTicketDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().min(1), ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    const { data: ticket } = await supabaseAdmin.from("tickets").select("*").eq("id", data.ticketId).maybeSingle();
    if (!ticket) return { success: false as const, error: "Ticket not found." };
    const [{ data: messages }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("ticket_messages").select("*").eq("ticket_id", data.ticketId).order("created_at"),
      supabaseAdmin.from("profiles").select("email, display_name").eq("user_id", ticket.user_id).maybeSingle(),
    ]);
    return { success: true as const, ticket, messages: messages ?? [], customer: profile };
  });

export const adminImpersonateUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      accessToken: z.string().min(1),
      userId: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };
    if (auth.userId === data.userId) {
      return { success: false as const, error: "You are already signed in as this user." };
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!targetProfile?.email) {
      return { success: false as const, error: "Target user has no email." };
    }

    // Pick a redirect URL the magic link can land on. Prefer published site, fall back to localhost.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://www.askjanice.net";

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: targetProfile.email,
        options: { redirectTo: `${siteUrl}/dashboard` },
      });
    if (linkError || !linkData?.properties?.action_link) {
      return { success: false as const, error: linkError?.message || "Could not generate sign-in link." };
    }

    await supabaseAdmin.from("admin_impersonation_log").insert({
      admin_user_id: auth.userId,
      target_user_id: data.userId,
      reason: data.reason ?? null,
    });

    return {
      success: true as const,
      actionLink: linkData.properties.action_link,
      targetEmail: targetProfile.email,
    };
  });
