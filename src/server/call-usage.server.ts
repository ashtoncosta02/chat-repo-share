import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { planEnvironment } from "@/server/plan-access.server";

export async function reserveAgentCall(agentId: string, callKey: string) {
  const { data: agent, error: agentError } = await supabaseAdmin.from("agents").select("user_id").eq("elevenlabs_agent_id", agentId).maybeSingle();
  if (agentError || !agent) throw new Error("Receptionist not found.");
  const { data, error } = await supabaseAdmin.rpc("reserve_call_allowance", { p_user: agent.user_id, p_env: planEnvironment(), p_call_key: callKey, p_max_seconds: 600 });
  if (error) throw new Error(error.message);
  const result = data as { seconds?: number; reservation_id?: string; error?: string } | null;
  if (!result?.seconds || !result.reservation_id) throw new Error(result?.error || "Monthly call allowance reached.");
  return { seconds: result.seconds, reservationId: result.reservation_id };
}

export async function finishAgentCall(userId: string, conversationId: string, seconds: number, reservationId?: string) {
  const { error } = await supabaseAdmin.rpc("finalize_call_allowance", { p_user: userId, p_env: planEnvironment(), p_conversation_id: conversationId, p_seconds: seconds, ...(reservationId ? { p_reservation: reservationId } : {}) });
  if (error) throw new Error(error.message);
}

// Agent-scoped credential; never send the application key to the provider.
export async function callAllowanceCredential(agentId: string) {
  const secret = process.env.LOVABLE_API_KEY;
  if (!secret) throw new Error("Call allowance authentication is not configured.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`call-allowance:${agentId}`));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2,"0")).join("");
}