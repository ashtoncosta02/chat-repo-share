# Architecture rules

- Key the conversation detail content by the selected conversation ID so navigating between calls resets call-specific state and cannot mix the previous call's history or recording with the new call.
- Keep src/janice frozen; editable homepage pricing/copy uses presentation copies outside that directory and reuses untouched original sections.
- Resolve plan entitlements from trusted environment-filtered subscription price IDs; validate scenarios in the database and voice configuration, not just the editor.
- Meter calls using an owner-scoped durable reservation ledger, never deletable conversation history; provider duration limits and authenticated inbound initiation checks enforce admission. The ledger holds only a small admission slot per call while the provider limit comes from remaining minutes, so one long call never blocks other callers.
- Point all customer-facing URLs (webhooks, provider tool URLs, embed snippets, email links) at PUBLIC_APP_ORIGIN from src/lib/app-origin.ts, never a preview/-dev host; preview hosts are not stable for live traffic. OAuth redirect URIs stay separately pinned.
- Never refuse or drop a caller because of our own errors: only a verified blocked caller or an AllowanceDeniedError may reject a call; save the lead before any slow post-call step and every step fails independently.
- Website chat never sends automatic texts; scenario texts go only to the caller ID of real calls/texts, because a typed phone number is unverified.
- Scheduled jobs authenticate to /api/public/hooks/* with a database-generated token (cron_hook_tokens, read by pg_cron and checked via service-role-only verify_cron_hook_token); never put cron credentials in migrations or code, because repository contents are public.
- Click-to-call only bridges the owner's saved forwarding/notification phone to a phone already in their Leads, so a signed-in caller can never pick arbitrary numbers to ring.
