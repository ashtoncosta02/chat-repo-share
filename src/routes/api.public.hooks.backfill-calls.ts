import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly safety net for the ElevenLabs post-call webhook.
 *
 * If a post-call webhook request is ever dropped (network blip, bad signature,
 * provider retry exhaustion) the call would otherwise never appear in the app.
 * This sweep pulls the recent conversation list for every connected voice agent
 * and persists anything the app is missing. It is idempotent — calls that are
 * already stored are skipped.
 */
export const Route = createFileRoute("/api/public/hooks/backfill-calls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/server/cron-auth.server");
        const denied = await authorizeCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillRecentCalls } = await import("@/server/voice-call-backfill.server");
        const { checkElevenLabsApiKey, replayWebhookFailures } = await import(
          "@/server/webhook-health.server"
        );
        const { sendEmail } = await import("@/server/email.server");

        // 1. Self-check the voice credentials before anything else. A rejected
        // API key is the single failure that can silently stop calls from
        // landing in Threads, so alert the owner (at most once per 6h).
        const credential = await checkElevenLabsApiKey();
        if (!credential.ok) {
          const sixHoursAgo = new Date(Date.now() - 6 * 3600_000).toISOString();
          const { count } = await supabaseAdmin
            .from("email_send_log")
            .select("id", { count: "exact", head: true })
            .eq("template_name", "voice-credential-alert")
            .gte("created_at", sixHoursAgo);
          if ((count ?? 0) === 0) {
            const messageId = await sendEmail({
              to: "hello@askjanice.net",
              subject: "Janice alert: voice credentials are not working",
              html: `<p>The automated health check could not use the ElevenLabs credentials.</p>
<p><strong>${credential.label}:</strong> ${credential.detail}</p>
${credential.hint ? `<p>${credential.hint}</p>` : ""}
<p>Calls are still being parked and can be replayed from Admin &rarr; System health once this is fixed.</p>`,
            }).catch(() => null);
            await supabaseAdmin.from("email_send_log").insert({
              message_id: messageId,
              template_name: "voice-credential-alert",
              recipient_email: "hello@askjanice.net",
              status: messageId ? "sent" : "failed",
              metadata: { detail: credential.detail } as unknown as never,
            });
          }
        }

        // 1b. Finalize stale call-allowance reservations (no post-call
        // webhook after 3h) at 0 seconds so they stop holding minutes.
        let staleReservationsReleased = 0;
        {
          const cutoff = new Date(Date.now() - 3 * 3600_000).toISOString();
          const { data: stale, error: staleErr } = await supabaseAdmin
            .from("call_allowance_ledger")
            .select("id")
            .is("finalized_at", null)
            .lt("created_at", cutoff)
            .limit(500);
          if (staleErr) console.error("backfill-sweep: stale reservation lookup failed:", staleErr.message);
          for (const row of stale ?? []) {
            const { error: updErr } = await supabaseAdmin
              .from("call_allowance_ledger")
              .update({ actual_seconds: 0, finalized_at: new Date().toISOString() })
              .eq("id", row.id)
              .is("finalized_at", null);
            if (updErr) console.error("backfill-sweep: could not release reservation", row.id, updErr.message);
            else staleReservationsReleased++;
          }
        }

        // 2. Drain anything parked by a failed webhook verification.
        const replay = await replayWebhookFailures();

        const { data: agents, error } = await supabaseAdmin
          .from("agents")
          .select("id, elevenlabs_agent_id, business_name")
          .not("elevenlabs_agent_id", "is", null);


        if (error) {
          console.error("backfill-sweep: could not load agents:", error.message);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let scanned = 0;
        let saved = 0;
        let skipped = 0;
        let errors = 0;
        const recovered: Array<{ agent_id: string; saved: number }> = [];
        let leadsRecovered = 0;
        let missedCallersSaved = 0;
        type FailedNote = import("@/server/voice-call-backfill.server").FailedCallNote;
        const alertable: Array<FailedNote & { business: string }> = [];

        for (const agent of agents ?? []) {
          const elAgentId = agent.elevenlabs_agent_id;
          if (!elAgentId) continue;
          try {
            const r = await backfillRecentCalls({ elAgentId, pageSize: 30 });
            scanned += r.scanned;
            saved += r.saved;
            skipped += r.skipped;
            errors += r.errors;
            leadsRecovered += r.leadsRecovered;
            missedCallersSaved += r.missedCallersSaved;
            const business = agent.business_name || "Unknown business";
            for (const f of [...r.recentFailed, ...r.leadRecoveryFailures]) alertable.push({ ...f, business });
            if (r.saved > 0) {
              recovered.push({ agent_id: agent.id, saved: r.saved });
              console.warn(
                `backfill-sweep: recovered ${r.saved} missed call(s) for agent ${agent.id} — the post-call webhook did not deliver them`,
              );
            }
          } catch (e) {
            errors++;
            console.error("backfill-sweep: failed for agent", agent.id, e);
          }
        }

        // Backstop for website-chat transcripts: the last chat of a quiet
        // period has no follow-up traffic to piggyback on, so flush it here
        // rather than running a separate recurring job.
        const { sweepIdleWidgetChats } = await import("@/server/widget-chat-digest.server");
        const widgetDigest = await sweepIdleWidgetChats().catch((e) => {
          console.error("backfill-sweep: widget chat digest failed", e);
          return { notified: 0 };
        });

        // Lead repair passes. Silent: no emails or texts to anyone.
        const { repairLeadsMissingContact, recoverWidgetLeads } = await import("@/server/voice-call-backfill.server");
        const phoneRepair = await repairLeadsMissingContact().catch((e) => {
          console.error("backfill-sweep: lead phone repair failed", e);
          return { checked: 0, repaired: 0 };
        });
        const widgetLeads = await recoverWidgetLeads().catch((e) => {
          console.error("backfill-sweep: widget lead recovery failed", e);
          return { checked: 0, recovered: 0 };
        });

        // Failed-call digest to the platform inbox (never to customers).
        let failedCallsAlerted = 0;
        try {
          const { allowRequestStrict } = await import("@/server/rate-limit.server");
          const seen = new Set<string>();
          const fresh: typeof alertable = [];
          for (const f of alertable) {
            if (seen.has(f.conversationId)) continue;
            seen.add(f.conversationId);
            if (await allowRequestStrict(`failed-call-alert:${f.conversationId}`, 1, 30 * 86400)) fresh.push(f);
          }
          if (fresh.length > 0) {
            const esc = (v: unknown) =>
              String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
            const fmt = (u: number | null) =>
              u ? new Date(u * 1000).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }) : "unknown time";
            const rows = fresh
              .map((f) => `<tr><td>${esc(f.business)}</td><td>${esc(fmt(f.startUnix))}</td><td>${esc(f.terminationReason ?? "unknown")}</td><td>${esc(f.conversationId)}</td><td>${f.leadSaved ? "yes" : "NO"}</td></tr>`)
              .join("");
            await sendEmail({
              to: "hello@askjanice.net",
              subject: `Janice alert: ${fresh.length} call(s) failed or lost their lead`,
              html: `<p>These calls ended as failed, or their lead could not be saved:</p><table border="1" cellpadding="4" cellspacing="0"><tr><th>Business</th><th>Time (Toronto)</th><th>Reason</th><th>Conversation</th><th>Lead saved</th></tr>${rows}</table>`,
            });
            failedCallsAlerted = fresh.length;
          }
        } catch (e) {
          console.error("backfill-sweep: failed-call alert failed", e);
        }

        return new Response(
          JSON.stringify({
            leadsRecovered,
            missedCallersSaved,
            leadPhonesChecked: phoneRepair.checked,
            leadPhonesRepaired: phoneRepair.repaired,
            widgetLeadsChecked: widgetLeads.checked,
            widgetLeadsRecovered: widgetLeads.recovered,
            failedCallsAlerted,
            success: true,
            credentials: { ok: credential.ok, detail: credential.detail },
            replay,
            scanned,
            saved,
            skipped,
            errors,
            recovered,
            widgetChatsNotified: widgetDigest.notified,
            staleReservationsReleased,
          }),
          { headers: { "Content-Type": "application/json" } },
        );


      },
    },
  },
});
