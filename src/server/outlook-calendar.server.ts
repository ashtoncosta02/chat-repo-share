// Server-only Microsoft Outlook (Graph) Calendar OAuth + API helpers.
// Mirrors google-calendar.server.ts for parity.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
// Microsoft Entra requires redirect URIs to be registered exactly.
// Like Google Calendar, we use one canonical production origin so the user
// only has to register a single callback URL in Azure.
const CANONICAL_OAUTH_ORIGIN = "https://www.askjanice.net";

export const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Calendars.ReadWrite",
  "User.Read",
].join(" ");

export function getRedirectUri(_request: Request): string {
  return `${CANONICAL_OAUTH_ORIGIN}/api/public/outlook-calendar/callback`;
}

export function getClientCreds() {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft (Outlook) OAuth not configured");
  }
  return { clientId, clientSecret };
}

function stateSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-state-secret";
}

export function signState(payload: {
  user_id: string;
  agent_id: string;
  redirect_uri?: string;
}): string {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(
  state: string,
): { user_id: string; agent_id: string; redirect_uri?: string } | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Date.now() - decoded.t > 10 * 60 * 1000) return null;
    if (!decoded.user_id || !decoded.agent_id) return null;
    return {
      user_id: decoded.user_id,
      agent_id: decoded.agent_id,
      redirect_uri: decoded.redirect_uri,
    };
  } catch {
    return null;
  }
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = getClientCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
  return `${MS_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCreds();
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outlook token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCreds();
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outlook token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchUserInfo(
  accessToken: string,
): Promise<{ id: string; email: string; name: string }> {
  const res = await fetch(`${GRAPH_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph /me failed: ${res.status}`);
  const j = await res.json();
  return {
    id: j.id,
    email: j.mail || j.userPrincipalName || "",
    name: j.displayName || "",
  };
}

export async function getValidAccessToken(
  agentId: string,
): Promise<{ token: string; calendar_id: string; timezone: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("agent_outlook_calendar")
    .select("access_token, refresh_token, token_expires_at, calendar_id, timezone")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = new Date(data.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { token: data.access_token, calendar_id: data.calendar_id, timezone: data.timezone };
  }

  try {
    const refreshed = await refreshAccessToken(data.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("agent_outlook_calendar")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || data.refresh_token,
        token_expires_at: newExpiresAt,
        last_refresh_error: null,
      })
      .eq("agent_id", agentId);
    return {
      token: refreshed.access_token,
      calendar_id: data.calendar_id,
      timezone: data.timezone,
    };
  } catch (e) {
    console.error("outlook refresh failed", e);
    await supabaseAdmin
      .from("agent_outlook_calendar")
      .update({ last_refresh_error: e instanceof Error ? e.message : "refresh failed" })
      .eq("agent_id", agentId);
    return null;
  }
}

// Free/busy using Graph getSchedule.
export async function checkFreeBusy(
  agentId: string,
  timeMin: string,
  timeMax: string,
): Promise<{ busy: Array<{ start: string; end: string }> } | { error: string }> {
  const conn = await getValidAccessToken(agentId);
  if (!conn) return { error: "Outlook calendar not connected" };

  // Find the account email via /me (we already have token).
  const meRes = await fetch(`${GRAPH_API}/me`, {
    headers: { Authorization: `Bearer ${conn.token}` },
  });
  if (!meRes.ok) return { error: `Graph /me ${meRes.status}` };
  const me = await meRes.json();
  const schedule = me.mail || me.userPrincipalName;

  const res = await fetch(`${GRAPH_API}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schedules: [schedule],
      startTime: { dateTime: timeMin, timeZone: "UTC" },
      endTime: { dateTime: timeMax, timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("outlook getSchedule failed", res.status, text);
    return { error: `getSchedule ${res.status}` };
  }
  const json = await res.json();
  const items = json.value?.[0]?.scheduleItems ?? [];
  const busy = items
    .filter((it: { status?: string }) => it.status !== "free")
    .map((it: { start: { dateTime: string }; end: { dateTime: string } }) => ({
      // Graph returns dates without trailing Z when in UTC zone — normalize.
      start: it.start.dateTime.endsWith("Z") ? it.start.dateTime : `${it.start.dateTime}Z`,
      end: it.end.dateTime.endsWith("Z") ? it.end.dateTime : `${it.end.dateTime}Z`,
    }));
  return { busy };
}

export async function createEvent(
  agentId: string,
  args: {
    summary: string;
    description?: string;
    start: string; // ISO
    end: string; // ISO
    attendeeEmail?: string;
    attendeeName?: string;
  },
): Promise<{ id: string; htmlLink: string } | { error: string }> {
  const conn = await getValidAccessToken(agentId);
  if (!conn) return { error: "Outlook calendar not connected" };

  const event = {
    subject: args.summary,
    body: args.description ? { contentType: "Text", content: args.description } : undefined,
    start: { dateTime: args.start, timeZone: "UTC" },
    end: { dateTime: args.end, timeZone: "UTC" },
    attendees: args.attendeeEmail
      ? [
          {
            emailAddress: { address: args.attendeeEmail, name: args.attendeeName || args.attendeeEmail },
            type: "required",
          },
        ]
      : [],
  };

  const res = await fetch(`${GRAPH_API}/me/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("outlook createEvent failed", res.status, text);
    return { error: `createEvent ${res.status}` };
  }
  const json = await res.json();
  return { id: json.id, htmlLink: json.webLink || "" };
}
