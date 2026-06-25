## What you'll need to do first (Azure setup)

Before I write code, you need a Microsoft Entra (Azure) app registration. I'll walk you through it:

1. Go to **portal.azure.com** → search "Microsoft Entra ID" → **App registrations** → **New registration**.
2. **Name:** "Ask Janice Outlook Calendar" (or anything).
3. **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts" (so both work + personal Outlook accounts work).
4. **Redirect URI:** Web → `https://www.askjanice.net/api/public/outlook-calendar/callback`
5. Click **Register**. Copy the **Application (client) ID** from the overview.
6. Go to **Certificates & secrets** → **New client secret** → 24 months → copy the **Value** (not the ID).
7. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → add:
   - `Calendars.ReadWrite`
   - `offline_access`
   - `User.Read`
8. Click **Grant admin consent** (only required for your own tenant test; end users consent themselves).

Then I'll prompt you to paste the **Client ID** and **Client Secret** as secrets (`MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`).

## What I'll build (mirrors Google Calendar exactly)

### Database
- New table `agent_outlook_calendar` (same shape as `agent_google_calendar`: tokens, expiry, selected calendar id, business hours, timezone).
- Reuse existing `calendar_bookings` table — add a `provider` column (`'google' | 'outlook'`) so both providers write to one place.
- RLS + grants matching Google's setup.

### Server
- `src/server/outlook-calendar.server.ts` — Microsoft Graph helpers (token exchange, refresh, list calendars, free/busy, create event, delete event).
- `src/lib/outlook-calendar.functions.ts` — server functions: `startOutlookOAuth`, `disconnectOutlook`, `updateOutlookSettings`, `listOutlookCalendars`, mirrors of the Google ones.
- `src/routes/api.public.outlook-calendar.callback.ts` — OAuth callback exchanges code → tokens → saves row.
- Update `src/server/widget-booking-tools.ts` (`findSlots`, `bookAppointment`) to detect which provider the agent has connected and route to the right API. If both connected, prefer Outlook only if Google not connected (one provider per agent enforced in UI).
- Update voice tool endpoints (`/api/public/voice-tools/*`) the same way.

### UI
- `src/components/dashboard/OutlookCalendarCard.tsx` — connect/disconnect, calendar picker, business hours, timezone. Same visual style as `GoogleCalendarCard`.
- On the agent dashboard, show a single "Calendar" section with tabs **Google** / **Outlook**. Only one can be connected at a time — connecting one disables the other with a "Disconnect [other] first" message.
- `CalendarHealthBanner` updated to check whichever provider is active.
- Bookings page (`dashboard.bookings.tsx`) shows a "Source" column (Google / Outlook badge).

### Edge cases handled
- Token refresh (Outlook refresh tokens expire after 90 days of inactivity — banner warns).
- User disconnects Outlook → row deleted, future bookings skip the calendar step.
- Personal Microsoft accounts work the same as work/school accounts (the `common` tenant + multi-tenant app setting).

## Order of work

1. You complete Azure setup above and tell me you're ready.
2. I'll request the two secrets via the secrets prompt.
3. I migrate DB + add `provider` column.
4. Build server + functions + callback route.
5. Build UI card + integrate into dashboard.
6. Wire booking tools to route by provider.

Ready? Reply "azure done" once you've got the Client ID and Secret in hand and I'll request them and start building.