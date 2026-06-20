## Part 1 — Values to paste into Google Cloud Console Branding

Use the existing public pages on your verified domain:

- **Application home page:** `https://askjanice.net`
- **Application privacy policy link:** `https://askjanice.net/privacy`
- **Application terms of service link:** `https://askjanice.net/terms`

**Authorized domains** — keep the two Lovable ones already in the list and add:

- `askjanice.net`
- `www.askjanice.net`

(Don't include `https://` or paths in the Authorized domains field — Google wants just the bare domain.)

Once those four fields are filled, the **Verify branding** button will become clickable. Click it. Then go to the OAuth consent screen → **Publish app** → "Push to production". Because we only use basic scopes (`calendar.events`, `calendar.readonly`, `email`, `openid`), no Google review is required — it goes live instantly and refresh tokens stop expiring after 7 days.

## Part 2 — Dashboard warning when calendar token is broken

Add a lightweight health check + banner so you find out immediately if the token ever goes bad again (instead of mid-call).

### Backend
Add a new server function `getGoogleCalendarHealth(agent_id)` in `src/lib/google-calendar.functions.ts` that:

1. Looks up the row in `agent_google_calendar` for this user + agent.
2. If no row → returns `{ status: "not_connected" }`.
3. If `token_expires_at` is in the future → returns `{ status: "ok" }`.
4. Otherwise tries `refreshAccessToken(refresh_token)`:
   - Success → updates `access_token` + `token_expires_at`, returns `{ status: "ok" }`.
   - Failure → returns `{ status: "needs_reconnect", reason }` (does NOT delete the row, so user keeps their settings).

### Frontend
- New component `src/components/dashboard/CalendarHealthBanner.tsx` that calls the health server fn (via `useQuery`, refetch every 5 min + on window focus) and, when status is `needs_reconnect`, renders a red banner at the top of the dashboard:
  > "Google Calendar disconnected — the AI Receptionist can't book appointments until you reconnect." with a **Reconnect** button that scrolls to / opens the Google Calendar card.
- Render the banner inside `src/routes/dashboard.tsx` above `<Outlet />`, only when `user` and `onboardingChecked`. It needs the agent id, so we'll fetch the single agent id once at layout level (same query that's already used for the onboarding gate, just keep the `id`).

### Technical notes
- Reuse existing `refreshAccessToken` from `src/server/google-calendar.server.ts`; no new Google API surface needed.
- No schema change — we use existing columns (`token_expires_at`, `refresh_token`).
- Health endpoint is per-user via `getAuthenticatedUserId` + scoped to `auth.userId`, matching the pattern of the other functions in that file.
- Banner is suppressed on `/dashboard/onboarding` and `/dashboard/admin/*` to avoid noise during setup.

After you publish the OAuth app (Part 1), this banner should stay green permanently. If Google ever revokes again (e.g. user revoked access from their Google Account page), you'll see the red banner the next time you load the dashboard.
