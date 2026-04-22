

## Where we are vs. what the pricing page promises

Audit of the 12 features advertised on the landing page:

| # | Promise | Status | Notes |
|---|---|---|---|
| 1 | AI agent trained on your business | ✅ Built | New Agent form + scrape, system prompt in `agent-chat.ts` |
| 2 | Unlimited calls 24/7 | ⚠️ Half | Voice works in browser only — no real phone number yet |
| 3 | Lead capture (name/phone/email auto-saved) | ❌ Missing | `leads` table exists, but agent never extracts/inserts. Page is always empty |
| 4 | Full conversation transcripts | ⚠️ Half | Conversations row exists but messages never persisted; no transcript view |
| 5 | Analytics (volume, peak hours, leads) | ⚠️ Half | UI built but data is empty because conversations aren't being recorded |
| 6 | SMS follow-up after every call | ❌ Missing | No SMS provider wired |
| 7 | Live chat widget for website | ❌ Missing | No embeddable widget |
| 8 | Personal AI assistant to manage your agent | ❌ Missing | No meta-assistant |
| 9 | Instant human transfer for emergencies | ⚠️ Half | `emergency_number` stored but never triggered |
| 10 | Google Calendar booking | ⚠️ Half | `booking_link` stored, no real Calendar OAuth/API |
| 11 | One-click callback from leads dashboard | ✅ Built | `tel:` link on Leads page |
| 12 | Full setup — ready in minutes | ✅ Built | Scrape & fill works |

**Plus the unfulfilled checkout itself**: pricing form posts nowhere. No Stripe, no subscription, no paywall.

## What competitors do that we don't

From Retell / Synthflow / Bland / Goodcall / Breezy:
- **Real phone numbers** (Twilio buy-a-number flow) — table stakes
- **Outbound calling** (campaigns, callbacks)
- **Calendar deep-integration** (Cal.com / Google Calendar slot lookup, not just a link)
- **Embeddable web chat + voice widget** (one-line `<script>` install)
- **Post-call SMS** + email summaries
- **Knowledge base ingestion** (docs/PDFs, not just FAQ textarea) — Retell, Synthflow
- **Per-agent voice + tone preview** before going live
- **Call recording playback** with transcript timeline
- **Webhook / Zapier / CRM push** of leads
- **Booking-platform integrations** (Breezy's whole pitch — connect to Cal/Square/etc.)

## Build order — maximum efficiency

Sequenced so each step unblocks the next and starts delivering visible value fast. Foundation first, then phone, then channels, then polish, then payments.

### Phase 1 — Foundation (close the credibility gap)

1. **Persist conversations + messages on every chat** — every browser turn writes to `conversations` and `messages` so Analytics, Conversations, and Leads pages stop looking empty.
2. **Auto-extract leads from chat** — second LLM pass on each user message: pulls name / phone / email / notes and inserts into `leads`. Delivers feature #3.
3. **Conversation detail page** — click a row in Conversations → see full transcript with timestamps. Delivers feature #4.
4. **Edit & delete agents** — currently no way to update; needed before any paying customer.

### Phase 2 — Real phone (the #1 competitive gap)

5. **Twilio integration** — buy/assign a phone number per agent, wire inbound webhook → ElevenLabs Conversational AI agent (or our own STT→LLM→TTS loop), persist transcript + lead extraction same as chat.
6. **Emergency human transfer** — when escalation triggers fire, Twilio `<Dial>` to `emergency_number`. Delivers feature #9.
7. **One-click outbound callback** — Leads page button initiates a Twilio call back to the lead, agent reads a script. Upgrades feature #11.

### Phase 3 — Multi-channel

8. **SMS follow-up** — after each call/chat, Twilio SMS with a summary + booking link. Delivers feature #6.
9. **Embeddable chat widget** — `<script src="...widget.js" data-agent-id="...">` drops a chat bubble on any site. Delivers feature #7.
10. **Google Calendar booking** — OAuth connect, agent reads free/busy and books real events. Upgrades feature #10.

### Phase 4 — Polish & differentiation

11. **Knowledge base uploads** — PDFs / URLs ingested into pgvector, agent retrieves at runtime. Matches Retell/Synthflow.
12. **Voice picker + preview** — per-agent voice selection from ElevenLabs library with sample playback.
13. **Personal AI assistant** — chat in dashboard ("update Sunrise Dental's hours to…", "show me yesterday's leads") that mutates agents and queries data. Delivers feature #8.
14. **Webhook / Zapier export** — fire on new lead/conversation.

### Phase 5 — Monetization

15. **Stripe subscription on the pricing form** — $397/mo Elite plan, sign-up creates account + checkout, webhook gates dashboard access.
16. **Plan limits + multi-agent add-on pricing** — enforce 1 agent on Elite, allow purchasing more.

## Why this order

- Phases 1–2 turn the product from "demo" into "actually delivers what the homepage claims."
- Real phone (Phase 2) is the single biggest competitor parity gap and unlocks every later feature (SMS, callbacks, recording).
- Channels (Phase 3) compound on the phone foundation with no rework.
- Payments last because no one will pay $397/mo until the product fulfills its promises — better to onboard early users free, get testimonials, then turn on billing.

## Recommendation for your next message

Start with **Phase 1, step 1** (persist conversations + messages). It's small, unblocks 3 dashboard pages immediately, and you'll see real data flowing within minutes. Reply "go" and I'll implement it.

