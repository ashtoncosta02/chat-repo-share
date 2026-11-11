# Stop cutting calls off at 10 minutes

## What's confirmed
- **Your own click-to-call calls (the dialer):** these now hang up at exactly 10 minutes. Before the minutes tracking was added, they had no time limit. They also now use up the receptionist's monthly minutes.
- **AI receptionist calls and AI callbacks:** these also stop at 10 minutes. But the voice provider already ends calls at 10 minutes by default, and your receptionist never changed that setting. So this isn't new, but it is still a hard cut-off.

Why it happens: every call holds back a 10-minute "slot" of minutes when it starts, and that slot is also used as the call's maximum length. Raising the slot size alone would be risky. One long slot could hold back most of a business's remaining minutes, and then new callers could be turned away even though minutes are left. That would break the "never lose a lead" rule.

## Proposed fix
Keep holding back a small 10-minute slot when each call starts, so other callers are never blocked. Set the call's real maximum length separately, based on how many minutes the business has left. The real call length is still recorded when the call ends, so usage stays accurate.

1. **Dialer (your own calls):** no 10-minute cut-off. Each call can last as long as the business has minutes left, up to 4 hours.
2. **AI receptionist calls and AI callbacks:** the maximum becomes 30 minutes, or whatever minutes the business has left, whichever is shorter. If the minutes check itself fails, the call still goes through with a 30-minute limit.
3. A business that has run out of minutes is still refused exactly as it is today.

## Decisions for you (defaults shown)
- Should your own dialer calls keep counting against the receptionist's monthly minutes? **Default: yes**, as they do now, because each dialer call costs us phone charges.
- What's the longest an AI call should run? **Default: 30 minutes.**

## Technical details
- New helper `remainingAllowanceSeconds(userId)` in `src/server/call-usage.server.ts`. It uses the plan's minutes minus ledger usage (`actual_seconds ?? reserved_seconds`) for the current period, using the same period logic as `notifyAllowanceThresholds`.
- `reserveAgentCall` returns `maxSeconds = min(AI_CALL_MAX_SECONDS, reserved + remaining)`. `registerTwilioCall`, `placeOutboundCall` and the inbound minutes check send `maxSeconds` as `max_duration_seconds`. `FALLBACK_MAX_SECONDS` and `reserveOrDefault`'s fallback change to 1800.
- `api.public.twilio.dialer-bridge.ts`: `timeLimit = min(14400, reserved + remaining)`. The reservation stays 600s and is finalized with the real duration by the existing call-duration callback.
- No database change. The reservation function stays as it is.
- Update the minutes-check test plus one new test for the length calculation (Essential near the limit, Elite with lots left, lookup failure).
- Possible overage: several long calls running at the same time can go a little past the monthly minutes, by at most the minutes that were left when they started.
