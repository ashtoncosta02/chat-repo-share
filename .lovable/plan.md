# Auto-link Twilio numbers to ElevenLabs

Right now when you (or a future client) buy a phone number in the dashboard, it's only registered with Twilio + the SMS webhook. The voice side still requires the manual ElevenLabs "Import a number from Twilio" step you just did. This plan automates that step end-to-end.

## What changes for the user

1. Click **Choose** on a number in the agent dashboard → number is purchased from Twilio AND auto-linked to ElevenLabs in one step.
2. Owned numbers show a small **"AI receptionist connected ✓"** badge instead of the obsolete "Sync webhooks" button.
3. Releasing a number also unlinks it from ElevenLabs so you don't get charged for ghost numbers.

## Required from you (one-time, ~2 min)

ElevenLabs' import API needs your **Twilio Account SID** and **Twilio Auth Token** (the connector gateway hides these, so we need them stored as separate secrets). I'll prompt you for both via Lovable's add-secret flow before writing the wiring.

- Where to find them: [Twilio Console](https://console.twilio.com/) → Account Dashboard → "Account Info" panel.
- Stored as runtime secrets `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`. Never exposed to the browser.

## Implementation

**1. Database migration**
Add one nullable column to `phone_numbers`:
- `elevenlabs_phone_number_id text` — set when the number is registered with ElevenLabs; used to unlink later.

**2. Server: `src/server/twilio-numbers.ts` — `purchasePhoneNumber`**
After a successful Twilio purchase + DB insert, look up the agent's `elevenlabs_agent_id`. If present, call the existing `importTwilioNumber()` helper from `elevenlabs-agent.server.ts` using the new `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` env vars. On success, update the row with `elevenlabs_phone_number_id`. If the EL import fails, the Twilio purchase still succeeds — we just log it and surface a soft warning toast so the user isn't blocked (they can retry from the dashboard).

**3. Server: `releasePhoneNumber`**
Before deleting the Twilio number, if `elevenlabs_phone_number_id` is set, DELETE it from `https://api.elevenlabs.io/v1/convai/phone-numbers/{id}` (404 = already gone, ignore). Add a small helper `deleteElevenLabsPhoneNumber()` in `elevenlabs-agent.server.ts`.

**4. Server: new fallback `linkExistingNumberToElevenLabs` server fn**
For numbers already in your DB (like the one you just imported manually), expose a one-click "Connect to AI" button. This calls `importTwilioNumber()` and saves the returned ID. Lets us recover from the rare case where step 2 failed.

**5. UI: `src/components/dashboard/PhoneNumberSetup.tsx`**
On each owned number row, replace the current display with a status indicator:
- `elevenlabs_phone_number_id` set → green dot + "AI receptionist connected"
- not set → "Connect to AI" button that calls the new server fn

**6. UI: `src/routes/dashboard.phone-numbers.tsx`**
Replace the "Sync webhooks" button with the same connection status badge. The sync-webhooks server function stays in the codebase (still used internally for SMS), just removed from the UI since it's no longer something the user needs to think about.

## Out of scope (for now)

- Migrating numbers between agents (only 1-receptionist-per-account anyway).
- Bulk re-import of legacy numbers — the per-row "Connect to AI" button covers it.
- Showing ElevenLabs call logs in the dashboard — already handled by existing post-call webhook (`api.public.elevenlabs.postcall.ts`).

## Order of operations when you approve

1. I'll prompt you for `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` via add-secret.
2. Run the DB migration.
3. Wire the server changes.
4. Update the two UI surfaces.
5. You click **"Connect to AI"** once on your existing number to backfill it.
6. Done — every future number purchase is automatic.
