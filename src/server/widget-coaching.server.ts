import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Coaching notes for one receptionist, written by that receptionist's owner.
 * Only rows whose author is the agent's owner are used, so nobody else's
 * notes can ever reach this chat. Server-only: never returned to the visitor.
 */
export async function loadOwnerCoachingNotes(
  agentId: string,
  ownerId: string,
): Promise<{ rating: string; note: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("agent_feedback")
    .select("note, rating")
    .eq("agent_id", agentId)
    .eq("user_id", ownerId)
    .not("note", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[widget.chat] coaching notes lookup failed");
    return [];
  }
  return (data ?? [])
    .map((r) => ({ rating: String(r.rating ?? ""), note: String(r.note ?? "").trim().slice(0, 500) }))
    .filter((r) => r.note);
}
