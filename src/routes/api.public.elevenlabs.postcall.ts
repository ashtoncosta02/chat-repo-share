import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { captureLead } from "@/server/lead-extraction";
import { sendEmail } from "@/server/email.server";
import { renderTranscriptEmail } from "@/server/email-templates.server";
import { callerNumberFrom } from "@/lib/caller-number";

export { callerNumberFrom };

const EL_BASE = "https://api.elevenlabs.io/v1";

/**
 * ElevenLabs post-call webhook.
 * Configured in ElevenLabs dashboard → Workspace → Webhooks.
 * Signature header: `ElevenLabs-Signature: t=<unix>,v0=<hex hmac sha256>`
 *
 * Persists every completed phone call as a `conversations` row + `messages`
 * rows, then runs lead extraction so the call shows up under Leads too.
 */
function escHtml(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export const Route = createFileRoute("/api/public/elevenlabs/postcall")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
        const signature = request.headers.get("elevenlabs-signature");
        const rawBody = await request.text();

        // Best-effort conversation id purely for logging, so a rejected call
        // can be traced (and recovered) from the logs later.
        let logConvId = "unknown";
        try {
          const peek = JSON.parse(rawBody) as PostCallPayload;
          logConvId =
            peek.data?.conversation_id ??
            (peek as unknown as PostCallData).conversation_id ??
            "unknown";
        } catch {
          /* handled below */
        }

        let signatureTrusted = false;
        if (secret) {
          if (!signature) {
            console.warn(`postcall: missing signature for ${logConvId}; will verify via ElevenLabs API`);
          } else {
            const headerParts = signature.split(",").map((p) => p.trim());
            const ts = headerParts.find((p) => p.startsWith("t="))?.slice(2);
            const sigPart = headerParts.find((p) => p.startsWith("v0="));
            const sig = sigPart?.slice(3);
            if (!ts || !sig) {
              console.warn(`postcall: bad signature parts for ${logConvId}; will verify via ElevenLabs API`);
            } else {
              const ageSec = Math.abs(Date.now() / 1000 - Number(ts));
              if (!Number.isFinite(ageSec) || ageSec > 1800) {
                console.warn(`postcall: stale signature for ${logConvId}; will verify via ElevenLabs API`, ageSec);
              } else {
                const expected = createHmac("sha256", secret)
                  .update(`${ts}.${rawBody}`)
                  .digest("hex");
                const a = Buffer.from(sig, "hex");
                const b = Buffer.from(expected, "hex");
                signatureTrusted = a.length === b.length && timingSafeEqual(a, b);
                if (!signatureTrusted) {
                  console.warn(`postcall: invalid signature for ${logConvId}; will verify via ElevenLabs API`);
                }
              }
            }
          }
        }

        let payload: PostCallPayload;
        try {
          payload = JSON.parse(rawBody) as PostCallPayload;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        // Only handle transcription events. Audio + failure events ack OK so
        // EL doesn't retry, but they don't write transcripts.
        const eventType = payload.type ?? "post_call_transcription";
        if (eventType !== "post_call_transcription") {
          return new Response(`ok-skip-${eventType}`, { status: 200 });
        }

        let data = payload.data ?? (payload as unknown as PostCallData);
        let elAgentId = data.agent_id;
        const conversationId = data.conversation_id;
        if (!elAgentId || !conversationId) {
          console.warn("postcall: missing agent_id or conversation_id");
          return new Response("Missing fields", { status: 400 });
        }

        // If the saved HMAC secret is wrong, do not drop the call. Verify the
        // conversation exists in ElevenLabs with our API key, then persist the
        // canonical transcript returned by ElevenLabs. This keeps the endpoint
        // authenticated without burning more customer call credits.
        if (!signatureTrusted) {
          const verified = await fetchElevenLabsConversation(conversationId);
          if (!verified || !verified.agent_id || verified.agent_id !== elAgentId) {
            // Unverifiable payloads are never stored: they could be forged by
            // anyone. Real calls are recovered by the scheduled backfill, which
            // pulls canonical transcripts straight from ElevenLabs.
            console.error(
              `postcall: verification failed for ${conversationId} — rejected (backfill will recover real calls)`,
            );
            return new Response("Unauthorized", { status: 401 });
          }
          data = verified;
          elAgentId = verified.agent_id;
        }


        const result = await persistPostCall(elAgentId, conversationId, data);
        if (result.status === "agent-not-found") {
          console.warn("postcall: agent not found for", elAgentId);
          await quarantinePayload({ reason: "agent-not-found", conversationId, agentId: elAgentId, data });
          return new Response("ok-no-agent", { status: 200 });
        }
        if (result.status === "duplicate") {
          return new Response("ok-dup", { status: 200 });
        }
        if (result.status === "db-error") {
          return new Response("db-error", { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function fetchElevenLabsConversation(
  conversationId: string,
): Promise<(PostCallData & { agent_id: string; conversation_id: string }) | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(`${EL_BASE}/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    console.error("postcall: ElevenLabs conversation verify failed", res.status);
    return null;
  }
  const json = (await res.json()) as PostCallData;
  if (!json.agent_id || !json.conversation_id) return null;
  return json as PostCallData & { agent_id: string; conversation_id: string };
}

/**
 * Park an unverifiable payload instead of rejecting it. Nothing a real caller
 * said is ever thrown away — an admin can replay these from Admin → Health.
 */
async function quarantinePayload(opts: {
  reason: string;
  conversationId: string;
  agentId: string;
  data: PostCallData;
}): Promise<void> {
  try {
    await supabaseAdmin.from("webhook_failures").upsert(
      {
        reason: opts.reason,
        elevenlabs_conversation_id: opts.conversationId,
        elevenlabs_agent_id: opts.agentId,
        payload: opts.data as unknown as never,
      },
      { onConflict: "source,elevenlabs_conversation_id", ignoreDuplicates: true },
    );

    // Alert the platform owner immediately — at most one email per hour so a
    // burst of failures can't flood the inbox.
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("webhook_failures")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) <= 1) {
      await sendEmail({
        to: "hello@askjanice.net",
        subject: "Janice alert: a call could not be verified",
        html: `<p>A post-call transcript could not be verified and has been parked instead of dropped.</p>
<p><strong>Conversation:</strong> ${escHtml(opts.conversationId)}<br/><strong>Agent:</strong> ${escHtml(opts.agentId)}<br/><strong>Reason:</strong> ${escHtml(opts.reason)}</p>
<p>Open Admin &rarr; System health to check the ElevenLabs credentials and replay the parked call.</p>`,
      }).catch((e) => console.error("postcall: alert email failed", e));
    }
  } catch (e) {
    console.error("postcall: could not quarantine payload", e);
  }
}




export interface PostCallPayload {
  type?: string;
  event_timestamp?: number;
  data?: PostCallData;
}

export interface PostCallData {
  agent_id?: string;
  conversation_id?: string;
  status?: string;
  transcript?: Array<{
    role?: string;
    message?: string;
    text?: string;
    time_in_call_secs?: number;
  }>;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    phone_call?: { external_number?: string; agent_number?: string };
    sms?: { sms_user_phone_number?: string; [key: string]: unknown };
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
  };
}

type PersistResult =
  | { status: "ok"; conversationDbId: string }
  | { status: "duplicate" }
  | { status: "agent-not-found" }
  | { status: "db-error" };

/**
 * Persist a single post-call payload: insert conversation + messages,
 * then trigger lead extraction. Idempotent by elevenlabs_conversation_id.
 * Exported so the manual backfill server function can reuse it.
 */
export async function persistPostCall(
  elAgentId: string,
  conversationId: string,
  data: PostCallData,
  opts?: { silent?: boolean },
): Promise<PersistResult> {
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from("agents")
    .select("id, user_id, business_name, notify_email, notify_email_transcript, notify_sms_transcript, notify_phone")
    .eq("elevenlabs_agent_id", elAgentId)
    .maybeSingle();
  if (agentErr || !agent) {
    return { status: "agent-not-found" };
  }


  const { finishAgentCall, notifyAllowanceThresholds } = await import("@/server/call-usage.server");
  const reservationId = data.conversation_initiation_client_data?.dynamic_variables?.janice_call_reservation || undefined;
  const isPhoneCall = Boolean(data.metadata?.phone_call);
  // A text conversation is a real customer contact, never a dashboard test.
  const isSms =
    Boolean(data.metadata?.sms) ||
    data.conversation_initiation_client_data?.dynamic_variables?.system__channel === "twilio_sms";
  const callerNumber = callerNumberFrom(data);

  // Dashboard "Live voice test" sessions are owner practice runs. Only honour
  // the test flag/marker when the conversation did not come over the phone or
  // by text, so a real contact can never be hidden.
  if (!isPhoneCall && !isSms) {
    const isDashboardTestFlag =
      data.conversation_initiation_client_data?.dynamic_variables
        ?.is_dashboard_test === "true";
    const { data: testMarker } = await supabaseAdmin
      .from("dashboard_test_conversations")
      .select("id")
      .eq("elevenlabs_conversation_id", conversationId)
      .maybeSingle();
    if (isDashboardTestFlag || testMarker) {
      await finishAgentCall(agent.user_id, conversationId, 0, reservationId).catch((e: unknown) =>
        console.error("postcall: could not release test reservation", e),
      );
      return { status: "duplicate" };
    }
  }

  // Texts use no call time.
  const durationSec = isSms ? 0 : Math.max(0, Math.round(data.metadata?.call_duration_secs ?? 0));

  // Real calls are metered before conversation deduplication so deleting
  // history cannot reset call usage. A metering failure must never stop the
  // call or its lead being saved.
  try {
    await finishAgentCall(agent.user_id, conversationId, durationSec, reservationId);
  } catch (e) {
    console.error("postcall: finishAgentCall failed", e);
  }
  try {
    await notifyAllowanceThresholds(agent.user_id);
  } catch (e) {
    console.error("postcall: notifyAllowanceThresholds failed", e);
  }

  const transcriptArr = Array.isArray(data.transcript) ? data.transcript : [];
  const cleanedTurns = transcriptArr
    .map((t) => ({
      role: (t.role === "agent" ? "assistant" : "user") as "user" | "assistant",
      content: String(t.message ?? t.text ?? "").trim(),
    }))
    .filter((t) => t.content.length > 0);
  const messageCount = cleanedTurns.length;
  const userTurns = cleanedTurns.filter((t) => t.role === "user");
  const direction = data.conversation_initiation_client_data?.dynamic_variables?.call_direction;
  const leadSource: "voice" | "sms" = isSms ? "sms" : "voice";
  const runCaptureLead = (dbConversationId: string) =>
    captureLead({
      agentId: agent.id,
      userId: agent.user_id,
      conversationId: dbConversationId,
      source: leadSource,
      fallbackPhone: callerNumber,
      newInquiry: userTurns.length > 0 && direction !== "outbound",
      messages: cleanedTurns,
    });

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from("conversations")
    .select("id, lead_id")
    .eq("elevenlabs_conversation_id", conversationId)
    .order("started_at", { ascending: true })
    .limit(1);
  if (existingErr) {
    // Can't tell whether this call is already saved. Don't risk saving it
    // twice (duplicate leads and alerts): fail so the provider retries and the
    // recovery sweep picks it up, exactly like a failed insert.
    console.error("postcall: existing conversation lookup failed", existingErr.message);
    return { status: "db-error" };
  }
  const existing = existingRows?.[0];
  if (existing) {
    // Saved before but the lead never landed: make the lead safe now.
    if (!existing.lead_id && (userTurns.length > 0 || callerNumber)) {
      const r = await runCaptureLead(existing.id);
      if (!r.ok) console.error("postcall: lead capture for existing conversation failed", existing.id);
    }
    return { status: "duplicate" };
  }

  const startedAt = data.metadata?.start_time_unix_secs
    ? new Date(data.metadata.start_time_unix_secs * 1000).toISOString()
    : new Date().toISOString();
  const endedAt = new Date(
    new Date(startedAt).getTime() + durationSec * 1000,
  ).toISOString();

  // Notifications (owner email/SMS + caller scenario SMS) must only fire for
  // calls that just happened. Recovery sweeps and late webhook retries can
  // persist calls from days ago.
  const callAgeMs = Date.now() - new Date(startedAt).getTime();
  const isStaleCall = callAgeMs > 60 * 60 * 1000; // older than 1 hour
  const notify = opts?.silent !== true && !isStaleCall;
  if (!notify) {
    console.log(
      `postcall: notifications suppressed for ${conversationId} (silent=${opts?.silent === true}, ageMinutes=${Math.round(callAgeMs / 60000)})`,
    );
  }

  // 1. Conversation row.
  const { data: convo, error: convoErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      elevenlabs_conversation_id: conversationId,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSec,
      message_count: messageCount,
      ...(isSms ? { source: "sms" } : {}),
    })
    .select("id")
    .single();

  if (convoErr || !convo) {
    console.error("postcall: insert conversation failed", convoErr);
    return { status: "db-error" };
  }

  // 2. Messages.
  if (cleanedTurns.length > 0) {
    try {
      const rows = cleanedTurns.map((t) => ({
        user_id: agent.user_id,
        conversation_id: convo.id,
        role: t.role,
        content: t.content,
      }));
      const { error: msgErr } = await supabaseAdmin.from("messages").insert(rows);
      if (msgErr) console.error("postcall: insert messages failed", msgErr);
    } catch (e) {
      console.error("postcall: insert messages threw", e);
    }
  }

  let capturedLeadId: string | null = null;
  // 3. Lead — before anything slow. Only when the caller said something or
  // we know who they are (avoids empty leads for silent hangups).
  if (userTurns.length > 0 || callerNumber) {
    try {
      const r = await runCaptureLead(convo.id);
      capturedLeadId = r.leadId;
      if (!r.ok) console.error("postcall: lead capture failed for", convo.id);
    } catch (e) {
      console.error("postcall: lead capture threw", e);
    }
  }

  // 4. Summary.
  let summaryText: string | null = null;
  if (cleanedTurns.length > 0) {
    try {
      summaryText = await generateCallSummary(cleanedTurns);
      if (summaryText) {
        await supabaseAdmin
          .from("conversations")
          .update({ ai_summary: summaryText })
          .eq("id", convo.id);
      }
    } catch (e) {
      console.error("postcall: summary generation failed", e);
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const siteUrl = envUrl && !envUrl.includes("vercel.app") ? envUrl : "https://www.askjanice.net";

  // 5a. Owner email.
  if (notify && agent.notify_email_transcript !== false) {
    try {
      let ownerEmail = agent.notify_email?.trim() || null;
      if (!ownerEmail) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("user_id", agent.user_id)
          .maybeSingle();
        ownerEmail = prof?.email?.trim() || null;
      }
      if (ownerEmail) {
        // By the captured lead id, so repeat callers' details show too.
        const { data: leadRows } = capturedLeadId
          ? await supabaseAdmin
              .from("leads")
              .select("name, email, phone, address")
              .eq("id", capturedLeadId)
              .limit(1)
          : { data: null };
        const { subject, html } = renderTranscriptEmail({
          businessName: agent.business_name || "Your business",
          callerNumber,
          startedAt: new Date(startedAt),
          durationSeconds: durationSec,
          summary: summaryText,
          turns: cleanedTurns,
          conversationDashboardUrl: `${siteUrl}/dashboard/conversations/${convo.id}`,
          lead: leadRows?.[0] ?? null,
        });
        await sendEmail({ to: ownerEmail, subject, html });
      }
    } catch (e) {
      console.error("postcall: transcript email failed", e);
    }
  }

  // 5b. Owner SMS.
  if (notify && agent.notify_sms_transcript && agent.notify_phone?.trim()) {
    try {
      const { sendTranscriptSms } = await import("@/server/sms.server");
      await sendTranscriptSms({
        userId: agent.user_id,
        to: agent.notify_phone.trim(),
        businessName: agent.business_name || "Your business",
        callerNumber,
        durationSeconds: durationSec,
        summary: summaryText ?? "",
        dashboardUrl: `${siteUrl}/dashboard/conversations/${convo.id}`,
      });
    } catch (e) {
      console.error("postcall: transcript SMS failed", e);
    }
  }

  // 6. Scenario-driven post-call SMS to the caller.
  if (notify) {
    try {
      const { sendScenarioPostCallSms } = await import("@/server/scenario-sms.server");
      await sendScenarioPostCallSms({
        agentId: agent.id,
        userId: agent.user_id,
        callerNumber,
        turns: cleanedTurns,
        startedAt,
      });
    } catch (e) {
      console.error("postcall: scenario SMS failed", e);
    }
  }

  // 7. Recording last — slow and least important.
  if (!isSms) {
    try {
      const recordingUrl = await fetchAndStoreCallAudio({
        conversationId,
        userId: agent.user_id,
        dbConversationId: convo.id,
      });
      if (recordingUrl) {
        await supabaseAdmin
          .from("conversations")
          .update({ recording_url: recordingUrl })
          .eq("id", convo.id);
      }
    } catch (e) {
      console.error("postcall: recording fetch/upload failed", e);
    }
  }

  console.log(
    `postcall: saved conversation ${convo.id} (${messageCount} messages) for agent ${agent.id}`,
  );
  return { status: "ok", conversationDbId: convo.id };
}

/**
 * Fetch the recorded call audio from ElevenLabs and upload it to the
 * `call-audio` public storage bucket. Returns the public URL or null
 * when audio isn't available (e.g. EL still processing, recording disabled,
 * or the API call fails). Best-effort — never throws.
 */
export async function fetchAndStoreCallAudio(opts: {
  conversationId: string;
  userId: string;
  dbConversationId: string;
}): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `${EL_BASE}/convai/conversations/${encodeURIComponent(opts.conversationId)}/audio`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!res.ok) {
    console.warn(
      `postcall: EL audio fetch failed (${res.status}) for ${opts.conversationId}`,
    );
    return null;
  }

  const contentType = res.headers.get("content-type") ?? "audio/mpeg";
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("mp4") || contentType.includes("m4a")
      ? "m4a"
      : "mp3";

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) return null;

  const path = `${opts.userId}/${opts.dbConversationId}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("call-audio")
    .upload(path, buf, {
      contentType,
      upsert: true,
    });
  if (upErr) {
    console.error("postcall: storage upload failed", upErr);
    return null;
  }

  // Bucket is private. Store the storage path; the UI mints signed URLs.
  return path;
}

/**
 * Generate a short ~140-char summary of the call transcript using Lovable AI.
 * Returns null on any failure — caller treats summary as best-effort.
 */
async function generateCallSummary(
  turns: { role: string; content: string }[],
): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  // If the caller never actually spoke (only the agent's greeting is in the
  // transcript), don't ask the model to summarize — it will hallucinate intent
  // from the greeting text. Return a deterministic summary instead.
  const callerTurns = turns.filter((t) => t.role !== "assistant");
  if (callerTurns.length === 0) {
    return "Caller hung up without speaking.";
  }

  const transcript = turns
    .slice(0, 100)
    .map((t) => `${t.role === "assistant" ? "Agent" : "Caller"}: ${t.content}`)
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "Summarize this phone call transcript in a single concise sentence (max 140 characters). Focus on caller intent and outcome. No quotes, no prefix.",
        },
        { role: "user", content: transcript },
      ],
    }),
  });

  if (!res.ok) {
    console.warn("postcall: summary AI call failed", res.status);
    return null;
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = json.choices?.[0]?.message?.content?.trim();
  return summary && summary.length > 0 ? summary.slice(0, 280) : null;
}
