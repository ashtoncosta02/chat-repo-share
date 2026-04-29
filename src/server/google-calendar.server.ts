// Server-only Google Calendar OAuth + API helpers.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const LOVABLE_DEV_ORIGIN = "https://project--d1e796ad-671c-47e1-843b-cdecc02fe11f-dev.lovable.app";

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return false;
  }
}

function isPrivatePreviewOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host.endsWith(".lovableproject.com") || host.startsWith("id-preview--");
  } catch {
    return false;
  }
}

function getOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin && !isLocalOrigin(origin) && !isPrivatePreviewOrigin(origin)) return origin;

  const referer = request.headers.get("referer");
  if (referer) {
    const refererOrigin = new URL(referer).origin;
    if (!isLocalOrigin(refererOrigin) && !isPrivatePreviewOrigin(refererOrigin)) return refererOrigin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;
    if (!isLocalOrigin(forwardedOrigin) && !isPrivatePreviewOrigin(forwardedOrigin)) return forwardedOrigin;
  }

  const url = new URL(request.url);
  if (isLocalOrigin(url.origin) || isPrivatePreviewOrigin(url.origin)) return LOVABLE_DEV_ORIGIN;
  return `${url.protocol}//${url.host}`;
}

export function getRedirectUri(request: Request): string {
  return `${getOrigin(request)}/api/public/google-calendar/callback`;
}

export function getClientCreds() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }
  return { clientId, clientSecret };
}

// Sign state with HMAC so we can verify it on the callback.
function stateSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-state-secret";
}

export function signState(payload: { user_id: string; agent_id: string }): string {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { user_id: string; agent_id: string } | null {
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
    if (Date.now() - decoded.t > 10 * 60 * 1000) return null; // 10 min
    if (!decoded.user_id || !decoded.agent_id) return null;
    return { user_id: decoded.user_id, agent_id: decoded.agent_id };
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
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
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
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCreds();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchUserInfo(accessToken: string): Promise<{ id: string; email: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`);
  return res.json();
}

// Get a valid access token for an agent connection, refreshing if needed.
export async function getValidAccessToken(agentId: string): Promise<{ token: string; calendar_id: string; timezone: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("agent_google_calendar")
    .select("access_token, refresh_token, token_expires_at, calendar_id, timezone")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = new Date(data.token_expires_at).getTime();
  // Refresh if less than 60s left
  if (Date.now() < expiresAt - 60_000) {
    return { token: data.access_token, calendar_id: data.calendar_id, timezone: data.timezone };
  }

  try {
    const refreshed = await refreshAccessToken(data.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("agent_google_calendar")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("agent_id", agentId);
    return { token: refreshed.access_token, calendar_id: data.calendar_id, timezone: data.timezone };
  } catch (e) {
    console.error("refresh failed", e);
    return null;
  }
}

// Check free/busy in a window
export async function checkFreeBusy(
  agentId: string,
  timeMin: string,
  timeMax: string,
): Promise<{ busy: Array<{ start: string; end: string }> } | { error: string }> {
  const conn = await getValidAccessToken(agentId);
  if (!conn) return { error: "Calendar not connected" };

  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: conn.timezone,
      items: [{ id: conn.calendar_id }],
    }),
  });
  if (!res.ok) return { error: `freeBusy ${res.status}` };
  const json = await res.json();
  const busy = json.calendars?.[conn.calendar_id]?.busy ?? [];
  return { busy };
}

// Create a calendar event
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
  if (!conn) return { error: "Calendar not connected" };

  const event = {
    summary: args.summary,
    description: args.description,
    start: { dateTime: args.start, timeZone: conn.timezone },
    end: { dateTime: args.end, timeZone: conn.timezone },
    attendees: args.attendeeEmail
      ? [{ email: args.attendeeEmail, displayName: args.attendeeName }]
      : undefined,
  };

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("createEvent failed", res.status, text);
    return { error: `createEvent ${res.status}` };
  }
  const json = await res.json();
  return { id: json.id, htmlLink: json.htmlLink };
}
