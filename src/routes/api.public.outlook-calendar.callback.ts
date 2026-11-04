import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeCode,
  fetchUserInfo,
  getRedirectUri,
  verifyState,
} from "@/server/outlook-calendar.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resyncReceptionistById } from "@/server/elevenlabs-agent-resync.server";
import { escapeHtml, oauthHtmlResponse as htmlResponse } from "@/server/oauth-html.server";

const TRY_AGAIN = `<p>Please close this window and try connecting again from your dashboard.</p>`;

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
          console.error("outlook oauth returned error:", errorParam, errorDesc);
          return htmlResponse(
            "Cancelled",
            `<h1>Connection cancelled</h1><p>You can close this window.</p>`,
            400,
          );
        }
        if (!code || !state) {
          return htmlResponse("Error", `<h1>Missing code or state</h1>${TRY_AGAIN}`, 400);
        }

        const verified = verifyState(state);
        if (!verified) {
          return htmlResponse("Error", `<h1>Invalid or expired link</h1>${TRY_AGAIN}`, 400);
        }

        // Ownership check BEFORE touching any calendar rows.
        const { data: ownedAgent } = await supabaseAdmin
          .from("agents")
          .select("id")
          .eq("id", verified.agent_id)
          .eq("user_id", verified.user_id)
          .maybeSingle();
        if (!ownedAgent) {
          return htmlResponse("Error", `<h1>Receptionist not found</h1>`, 403);
        }

        try {
          const redirectUri = verified.redirect_uri || getRedirectUri(request);
          const tokens = await exchangeCode(code, redirectUri);
          if (!tokens.refresh_token) {
            return htmlResponse(
              "Error",
              `<h1>No refresh token received</h1><p>Please remove access at <a href="https://account.live.com/consent/Manage" target="_blank" rel="noopener noreferrer">account.live.com/consent/Manage</a> and try connecting again.</p>`,
              400,
            );
          }
          const userInfo = await fetchUserInfo(tokens.access_token);

          // One provider per agent.
          await supabaseAdmin
            .from("agent_google_calendar")
            .delete()
            .eq("agent_id", verified.agent_id)
            .eq("user_id", verified.user_id);

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
            return htmlResponse("Error", `<h1>Something went wrong</h1>${TRY_AGAIN}`, 500);
          }

          await resyncReceptionistById(verified.agent_id).catch((e: unknown) => {
            console.error("resync after outlook connect failed:", e);
          });

          return htmlResponse(
            "Connected",
            `<h1>✓ Outlook Calendar connected</h1><p>Signed in as <strong>${escapeHtml(userInfo.email)}</strong></p><p>You can close this window.</p>`,
          );
        } catch (e) {
          console.error("outlook callback error", e);
          return htmlResponse("Error", `<h1>Connection failed</h1>${TRY_AGAIN}`, 500);
        }
      },
    },
  },
});
