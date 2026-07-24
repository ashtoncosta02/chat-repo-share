import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderTranscriptEmail } from "@/server/email-templates.server";

/**
 * Bridge between the website chat widget and the main "Threads" table.
 *
 * Every widget conversation gets a mirror row in `conversations` (source =
 * "widget") so the dashboard shows chats alongside voice calls. Each user
 * and assistant turn is copied into `messages` for the transcript view.
 * The first meaningful chat also triggers an owner notification (email +
 * SMS if configured), exactly once per widget conversation.
 */

interface EnsureThreadArgs {
  widgetConversationId: string;
  userId: string;
  agentId: string;
  startedAt?: string | null;
}

/** Create the mirror `conversations` row if it doesn't already exist. */
export async function ensureThreadForWidgetConversation(
  args: EnsureThreadArgs,
): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("widget_conversation_id", args.widgetConversationId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: args.userId,
      agent_id: args.agentId,
      widget_conversation_id: args.widgetConversationId,
      source: "widget",
      started_at: args.startedAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) {
    // Race: another request may have created it between select + insert.
    const { data: retry } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("widget_conversation_id", args.widgetConversationId)
      .maybeSingle();
    return retry?.id ?? null;
  }
  return created.id;
}

interface MirrorTurnArgs {
  threadId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
}

/** Append one turn into `messages` and bump the thread's counters. */
export async function mirrorTurnToThread(args: MirrorTurnArgs): Promise<void> {
  await supabaseAdmin.from("messages").insert({
    conversation_id: args.threadId,
    user_id: args.userId,
    role: args.role,
    content: args.content,
  });
  // Refresh the aggregate counters shown in the Threads list.
  const { count } = await supabaseAdmin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", args.threadId);
  await supabaseAdmin
    .from("conversations")
    .update({
      message_count: count ?? 0,
      ended_at: new Date().toISOString(),
    })
    .eq("id", args.threadId);
}

interface NotifyArgs {
  widgetConversationId: string;
  threadId: string;
  agentId: string;
  userId: string;
  pageUrl: string | null;
  visitorName: string | null;
  visitorEmail: string | null;
  userTurnCount: number;
}

/**
 * Fire the owner alert once per widget conversation, after the visitor
 * has clearly engaged (>= 2 user messages). Uses the same transcript
 * email + SMS helpers as voice calls, so notification preferences are
 * honored uniformly.
 */
export async function maybeNotifyOwnerForWidgetChat(args: NotifyArgs): Promise<void> {
  if (args.userTurnCount < 2) return;

  const { data: convo } = await supabaseAdmin
    .from("widget_conversations")
    .select("notified_at")
    .eq("id", args.widgetConversationId)
    .maybeSingle();
  if (!convo || convo.notified_at) return;

  // Claim the notification slot up front so parallel requests don't double-send.
  const { data: claimed } = await supabaseAdmin
    .from("widget_conversations")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", args.widgetConversationId)
    .is("notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  try {
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select(
        "business_name, notify_email, notify_email_transcript, notify_sms_transcript, notify_phone",
      )
      .eq("id", args.agentId)
      .maybeSingle();
    if (!agent) return;

    const { data: thread } = await supabaseAdmin
      .from("conversations")
      .select("started_at, ai_summary")
      .eq("id", args.threadId)
      .maybeSingle();

    const { data: turns } = await supabaseAdmin
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", args.threadId)
      .order("created_at", { ascending: true });

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("name, email, phone, address")
      .eq("conversation_id", args.threadId)
      .maybeSingle();

    const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const siteUrl =
      envUrl && !envUrl.includes("vercel.app") ? envUrl : "https://www.askjanice.net";
    const dashboardUrl = `${siteUrl}/dashboard/conversations/${args.threadId}`;

    const cleanedTurns = (turns ?? [])
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => ({ role: t.role as "user" | "assistant", content: t.content }));

    const callerLabel =
      args.visitorName || args.visitorEmail || args.pageUrl || "Website visitor";

    // Email
    if (agent.notify_email_transcript !== false) {
      const { sendEmail } = await import("@/server/email.server");
      let ownerEmail = agent.notify_email?.trim() || null;
      if (!ownerEmail) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("user_id", args.userId)
          .maybeSingle();
        ownerEmail = prof?.email?.trim() || null;
      }
      if (ownerEmail) {
        const { subject, html } = renderTranscriptEmail({
          businessName: agent.business_name || "Your business",
          callerNumber: callerLabel,
          startedAt: new Date(thread?.started_at ?? Date.now()),
          durationSeconds: 0,
          summary: thread?.ai_summary ?? null,
          turns: cleanedTurns,
          conversationDashboardUrl: dashboardUrl,
          lead: lead
            ? {
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                address: lead.address,
              }
            : {
                name: args.visitorName,
                email: args.visitorEmail,
                phone: null,
                address: null,
              },
        });
        const wsSubject = subject.replace(/^New call/i, "New website chat");
        await sendEmail({ to: ownerEmail, subject: wsSubject, html });
      }
    }

    // SMS
    if (agent.notify_sms_transcript && agent.notify_phone?.trim()) {
      const { sendTranscriptSms } = await import("@/server/sms.server");
      const summary =
        thread?.ai_summary ||
        cleanedTurns
          .filter((t) => t.role === "user")
          .map((t) => t.content)
          .join(" • ")
          .slice(0, 400) ||
        "New website chat started.";
      await sendTranscriptSms({
        userId: args.userId,
        to: agent.notify_phone.trim(),
        businessName: agent.business_name || "Your business",
        callerNumber: callerLabel,
        durationSeconds: 0,
        summary,
        dashboardUrl,
      });
    }
  } catch (e) {
    console.error("widget notify: failed", e);
    // Leave notified_at set to avoid retry storms; owner can still see the
    // thread in the dashboard.
  }
}
