import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeCode,
  fetchUserInfo,
  getRedirectUri,
  verifyState,
} from "@/server/outlook-calendar.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resyncReceptionistById } from "@/server/elevenlabs-agent-resync.server";

function htmlResponse(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;color:#222}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:32px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.04)}
h1{margin:0 0 12px;font-size:20px}p{color:#555;line-height:1.5}a{color:#b8860b;text-decoration:none;font-weight:600}</style>
</head><body><div class="card">${body}</div>
<script>setTimeout(function(){if(window.opener){window.close()}},2500)</script>
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/outlook-calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        if (errorParam) {
          return htmlResponse(
            "Cancelled",
            `<h1>Connection cancelled</h1><p>${errorDesc || errorParam}</p><p>You can close this window.</p>`,
            400,
          );
        }
        if (!code || !state) {
          return htmlResponse("Error", `<h1>Missing code or state</h1>`, 400);
        }

        const verified = verifyState(state);
        if (!verified) {
          return htmlResponse("Error", `<h1>Invalid or expired state</h1>`, 400);
        }

        try {
          const redirectUri = verified.redirect_uri || getRedirectUri(request);
          const tokens = await exchangeCode(code, redirectUri);
          if (!tokens.refresh_token) {
            return htmlResponse(
              "Error",
              `<h1>No refresh token received</h1><p>Please remove access at <a href="https://account.live.com/consent/Manage" target="_blank">account.live.com/consent/Manage</a> and try connecting again.</p>`,
              400,
            );
          }
          const userInfo = await fetchUserInfo(tokens.access_token);

          // Disconnect any existing Google connection first — one provider per agent.
          await supabaseAdmin
            .from("agent_google_calendar")
            .delete()
            .eq("agent_id", verified.agent_id);

          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error } = await supabaseAdmin.from("agent_outlook_calendar").upsert(
            {
              agent_id: verified.agent_id,
              user_id: verified.user_id,
              microsoft_account_email: userInfo.email,
              microsoft_account_name: userInfo.name,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              token_expires_at: expiresAt,
              scope: tokens.scope,
              calendar_id: "primary",
              last_refresh_error: null,
            },
            { onConflict: "agent_id" },
          );

          if (error) {
            console.error("outlook upsert failed", error);
            return htmlResponse("Error", `<h1>Database error</h1><p>${error.message}</p>`, 500);
          }

          await resyncReceptionistById(verified.agent_id).catch((e: unknown) => {
            console.error("resync after outlook connect failed:", e);
          });

          return htmlResponse(
            "Connected",
            `<h1>✓ Outlook Calendar connected</h1><p>Signed in as <strong>${userInfo.email}</strong></p><p>You can close this window.</p>`,
          );
        } catch (e) {
          console.error("outlook callback error", e);
          const msg = e instanceof Error ? e.message : "Unknown error";
          return htmlResponse("Error", `<h1>Connection failed</h1><p>${msg}</p>`, 500);
        }
      },
    },
  },
});
