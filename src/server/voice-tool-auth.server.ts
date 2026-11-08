// Per-agent shared secret sent by ElevenLabs booking webhook tools.
import { createHmac, timingSafeEqual } from "crypto";

export const VOICE_TOOL_HEADER = "x-janice-tool-key";

export function voiceToolCredential(agentDbId: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createHmac("sha256", key).update(`voice-tool:${agentDbId}`).digest("hex");
}

export function verifyVoiceToolRequest(
  request: Request,
  agentDbId: string,
): "ok" | "missing" | "invalid" {
  const provided = request.headers.get(VOICE_TOOL_HEADER);
  if (!provided) return "missing";
  let expected: string;
  try {
    expected = voiceToolCredential(agentDbId);
  } catch (e) {
    console.error("voice tool credential unavailable", e);
    return "invalid";
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}

/**
 * Every receptionist was resynced on 2026-11-08 and all four booking tools
 * send the x-janice-tool-key header (checked in ElevenLabs).
 */
export const VOICE_TOOL_AUTH_ENFORCED = true;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Returns a Response to send when the request must be rejected, else null. */
export function voiceToolAuthFailure(request: Request, agentDbId: string, route: string): Response | null {
  const status = verifyVoiceToolRequest(request, agentDbId);
  const json = (body: unknown, code: number) =>
    new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });
  if (status === "invalid") return json({ error: "Forbidden" }, 403);
  if (status === "missing") {
    if (VOICE_TOOL_AUTH_ENFORCED) return json({ error: "Unauthorized" }, 401);
    console.warn(`[${route}] request without ${VOICE_TOOL_HEADER} for agent ${agentDbId} (allowed: enforcement off)`);
  }
  return null;
}
