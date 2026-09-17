import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maybeNotifyOwnerForWidgetChat } from "@/server/widget-thread-mirror.server";

/**
 * Website-chat transcript sweep.
 *
 * Widget chats used to email the owner the moment the visitor sent their
 * second message, which meant the transcript was cut off mid-conversation.
 * Instead we wait until the chat has gone quiet for a few minutes and then
 * send the full transcript once.
 *
 * This is invoked from live widget chat traffic (piggybacking on requests the
 * app already handles) and from the existing missed-calls cron sweep as a
 * backstop, so no dedicated recurring job is needed.
 */

const IDLE_MINUTES = 4;

export async function sweepIdleWidgetChats(): Promise<{ notified: number; error?: string }> {
  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000).toISOString();

  const { data: convos, error } = await supabaseAdmin
    .from("widget_conversations")
    .select("id, agent_id, user_id, page_url, updated_at, notified_at")
    .is("notified_at", null)
    .lt("updated_at", cutoff)
    .gt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(50);

  if (error) return { notified: 0, error: error.message };

  let notified = 0;

  for (const convo of convos ?? []) {
    const { data: thread } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("widget_conversation_id", convo.id)
      .maybeSingle();
    if (!thread?.id) continue;

    const { count: userTurns } = await supabaseAdmin
      .from("widget_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convo.id)
      .eq("role", "user");

    if (!userTurns || userTurns < 2) continue;

    try {
      await maybeNotifyOwnerForWidgetChat({
        widgetConversationId: convo.id,
        threadId: thread.id,
        agentId: convo.agent_id,
        userId: convo.user_id,
        pageUrl: convo.page_url ?? null,
        visitorName: null,
        visitorEmail: null,
        userTurnCount: userTurns,
      });
      notified += 1;
    } catch (e) {
      console.error("widget chat digest error", convo.id, e);
    }
  }

  return { notified };
}
