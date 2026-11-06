# Architecture rules

- Key the conversation detail content by the selected conversation ID so navigating between calls resets call-specific state and cannot mix the previous call's history or recording with the new call.
- Keep src/janice frozen; editable homepage pricing/copy uses presentation copies outside that directory and reuses untouched original sections.
- Resolve plan entitlements from trusted environment-filtered subscription price IDs; validate scenarios in the database and voice configuration, not just the editor.
- Meter calls using an owner-scoped durable reservation ledger, never deletable conversation history; provider duration limits and authenticated inbound initiation checks enforce admission.
- Point all customer-facing URLs (webhooks, provider tool URLs, embed snippets, email links) at PUBLIC_APP_ORIGIN from src/lib/app-origin.ts, never a preview/-dev host; preview hosts are not stable for live traffic. OAuth redirect URIs stay separately pinned.
- Never refuse or drop a caller because of our own errors: only a verified blocked caller or an AllowanceDeniedError may reject a call; save the lead before any slow post-call step and every step fails independently.
