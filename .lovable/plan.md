## Add Outlook Calendar health & status indicator

Right now the Outlook card just says "Connected" once a row exists in the DB, and the top-of-dashboard `CalendarHealthBanner` only checks Google. If your Microsoft refresh token expires or is revoked, nothing tells you until a booking silently fails.

### What I'll add

1. **Inline status pill on the Outlook card** (`OutlookCalendarCard.tsx`)
   - On mount (and on window focus), call the existing `getOutlookCalendarHealth` server function.
   - Replace the current static "Connected" pill with one of:
     - Green "Connected" — token valid, shows account email.
     - Amber "Reconnect needed" — refresh failed; button switches from "Disconnect" to "Reconnect" (runs the connect flow again).
     - Red "Error" — with the returned reason in a tooltip.
   - Show "Last checked Xm ago" under the email line.

2. **Extend the top dashboard banner** (`CalendarHealthBanner.tsx`)
   - Also call `getOutlookCalendarHealth` in parallel with the Google check.
   - If either provider returns `needs_reconnect`, show the red banner naming the correct provider ("Outlook Calendar disconnected" vs "Google Calendar disconnected").
   - Link goes to `/dashboard/agent` as today.

3. **No backend changes** — `getOutlookCalendarHealth` already exists and even auto-refreshes the token when it can, so this is purely a UI wiring change.

### Files touched
- `src/components/dashboard/OutlookCalendarCard.tsx` — add health check + status pill + reconnect button state.
- `src/components/dashboard/CalendarHealthBanner.tsx` — add Outlook check alongside Google.

No DB migrations, no new secrets, no route changes.
