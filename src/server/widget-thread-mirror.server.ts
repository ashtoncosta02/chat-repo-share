import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderTranscriptEmail } from "@/server/email-templates.server";

/**
 * Bridge between the website chat widget and the main "Threads" table.
 *
 * Every widget conversation gets a mirror row in `conversations` (source =
 * "widget") so the dashboard shows chats alongside voice calls. Each user
 * and assistant turn is copied into `messages` for the transcript view.
 * Meaningful chats also trigger owner notifications (email + SMS if
 * configured), with a cooldown so a long-lived browser session can still
 * alert the owner about a later new inquiry.
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

const WIDGET_NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000;

function isNotificationRecent(notifiedAt: string | null): boolean {
  if (!notifiedAt) return false;
  const notifiedTime = new Date(notifiedAt).getTime();
  if (!Number.isFinite(notifiedTime)) return false;
  return Date.now() - notifiedTime < WIDGET_NOTIFICATION_COOLDOWN_MS;
}

/**
 * Fire the owner alert after the visitor has clearly engaged (>= 2 user
 * messages). Uses the same transcript
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
  if (!convo || isNotificationRecent(convo.notified_at)) return;

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select(
      "business_name, notify_email, notify_email_transcript, notify_sms_transcript, notify_phone",
    )
    .eq("id", args.agentId)
    .maybeSingle();
  if (!agent) return;

  let ownerEmail = agent.notify_email?.trim() || null;
  if (agent.notify_email_transcript !== false && !ownerEmail) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", args.userId)
      .maybeSingle();
    ownerEmail = prof?.email?.trim() || null;
  }

  const wantsEmail = agent.notify_email_transcript !== false && !!ownerEmail;
  const wantsSms = !!(agent.notify_sms_transcript && agent.notify_phone?.trim());
  if (!wantsEmail && !wantsSms) return;

  // Claim the notification slot up front so parallel requests don't double-send.
  // `notified_at` is treated as the last alert timestamp, not a permanent
  // "already notified forever" flag. That matters because website widgets can
  // keep the same browser session alive across multiple separate inquiries.
  const nextNotifiedAt = new Date().toISOString();
  let claimQuery = supabaseAdmin
    .from("widget_conversations")
    .update({ notified_at: nextNotifiedAt })
    .eq("id", args.widgetConversationId)
    .select("id");
  if (convo.notified_at) {
    claimQuery = claimQuery.eq("notified_at", convo.notified_at);
  } else {
    claimQuery = claimQuery.is("notified_at", null);
  }
  const { data: claimed } = await supabaseAdmin
    .from("widget_conversations")
    .select("id")
    .maybeSingle();
  const { data: claimRows } = await claimQuery;
  const claimedRow = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claimedRow && !claimed) return;

  let anySendAttempted = false;
  let anySendSucceeded = false;

  try {
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
      lead?.name || args.visitorName || args.visitorEmail || args.pageUrl || "Website visitor";

    // Email
    if (wantsEmail && ownerEmail) {
      const { sendEmail } = await import("@/server/email.server");
      anySendAttempted = true;
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
      const id = await sendEmail({ to: ownerEmail, subject: wsSubject, html });
      if (id) {
        anySendSucceeded = true;
        console.log("widget notify: email sent", { to: ownerEmail, id });
      } else {
        console.error("widget notify: email send returned null", { to: ownerEmail });
      }
    }

    // SMS
    if (agent.notify_sms_transcript && agent.notify_phone?.trim()) {
      anySendAttempted = true;
      try {
        const { sendTranscriptSms } = await import("@/server/sms.server");
        const summary =
          thread?.ai_summary ||
          cleanedTurns
            .filter((t) => t.role === "user")
            .map((t) => t.content)
            .join(" • ")
            .slice(0, 400) ||
          "New website chat started.";
        const sid = await sendTranscriptSms({
          userId: args.userId,
          to: agent.notify_phone.trim(),
          businessName: agent.business_name || "Your business",
          callerNumber: callerLabel,
          durationSeconds: 0,
          summary,
          dashboardUrl,
        });
        if (sid) {
          anySendSucceeded = true;
          console.log("widget notify: sms sent", { to: agent.notify_phone, sid });
        } else {
          console.error("widget notify: sms send returned null");
        }
      } catch (e) {
        console.error("widget notify: sms send threw", e);
      }
    }
  } catch (e) {
    console.error("widget notify: failed", e);
  } finally {
    // If we attempted sends but none succeeded, release the claim so the
    // next user message can retry the notification instead of silently
    // dropping it forever.
    if (anySendAttempted && !anySendSucceeded) {
      await supabaseAdmin
        .from("widget_conversations")
        .update({ notified_at: null })
        .eq("id", args.widgetConversationId);
    }
  }
}

