# Let owners call back website chat leads again

## The problem (confirmed)
Since the last security fix, "AI call back" and "Call from my phone" only work for numbers that Twilio shows phoned or texted the business. Website chat leads never did, so they always get "please call this customer from your own phone instead", while the Leads and Conversations pages still show both buttons for them.

This was the deliberate "strictest" choice (A). The lead's saved number can be edited by the account owner, so it can't prove anything on its own.

## The fix
Accept a second kind of proof that the owner also can't fake by editing a lead: the website chat itself.

A number counts as proven when either:
1. Twilio shows it phoned or texted one of the account's business numbers (unchanged), or
2. A visitor typed that same number in a website chat with this account's receptionist. Chat messages are saved by the app's own server, and owners can read them but not add or change them.

So editing a lead's number to a stranger's no longer works, but a real website chat lead can be called back again.

## What customers will notice
- Website chat leads can be called back from Leads, Conversations and inside a conversation again.
- A lead whose number was edited to something nobody ever called, texted or typed in chat is still refused, with the same message.

## Trade-off to accept
Anyone can type any number into a website chat, including the owner on their own site. So a determined owner could still get a stranger's number "proven" this way. That's much harder than editing a lead, but it's weaker than A, and the security scanner may raise it again.

## Technical details
- `src/server/contact-proof.server.ts`: add `numberTypedInWidgetChat(userId, e164)` using `supabaseAdmin`: look in `widget_messages` (role `user`) joined to `widget_conversations` where `user_id = userId`, limited to recent conversations (e.g. last 90 days, capped row count), normalise every phone-like run in the text to E.164 and compare. Also accept the phone recorded by the widget booking tool if it is stored server-side.
- `callerHasContactedBusiness`: return "verified" if the widget check matches, before or alongside the Twilio lookups; Twilio errors still return "error" only when the widget check also failed to match.
- Keep the gate in `aiCallbackLead`, `startOutboundCall` and `aiCallbackFromConversation` unchanged.
- Add tests in `src/lib/contact-proof.test.ts` for the phone-extraction/matching helper (formatted, spaced, +1 and bare 10-digit numbers; a different number does not match).
- Update the AGENTS.md outbound-call rule to name both accepted proofs.
- No database changes, no Twilio or ElevenLabs settings changes.
