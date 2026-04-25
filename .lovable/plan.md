## Decision: park the voice-call rework for now

The current Twilio voice flow still has two issues:

1. The voice doesn't sound the way it should (using Twilio's basic `<Say>` instead of ElevenLabs).
2. The agent re-greets the caller at the end of the conversation instead of cleanly saying thanks and hanging up.

Per your direction, we'll **leave the voice system as-is for now**, finish the rest of the app, and then come back at the end to rebuild the call layer properly (likely a different architecture — e.g. Twilio Media Streams + a realtime LLM/TTS pipeline, or a dedicated voice provider like Vapi/Retell/LiveKit) so it's both fast and natural-sounding.

I'll add a tracking note in memory so this doesn't get lost.

### What I need from you

Tell me what you'd like to work on next. A few likely candidates based on what's already in the app:

- **Leads page polish** (`dashboard/leads`) — filters, search, export, lead detail view
- **Conversations view** (`dashboard/conversations`) — transcripts, playback, tagging
- **Analytics dashboard** (`dashboard/analytics`) — call volume, conversion, agent performance charts
- **Agent configuration** (`dashboard/agents/$agentId`) — prompt editor, voice selection, business hours, FAQ knowledge base
- **Phone numbers management** (`dashboard/phone-numbers`) — buy/assign numbers, route to agents
- **SMS flow** (`api.public.twilio.sms.ts` already exists) — auto-reply, follow-up texts to leads after a call
- **Onboarding / new-agent wizard** — smoother first-run experience
- **Auth & billing** — plans, Stripe, team members

### What I'll do once you pick

1. Save a memory note: "Voice call system rework deferred to end of project — current implementation has latency + re-greeting + voice quality issues; revisit with Media Streams or dedicated voice provider."
2. Start on whichever area you choose.

### Just reply with the area (or a different one)

e.g. "Let's do the leads page" or "Work on agent configuration next."

We also need to work on google calendar integration and being able to add a live chat widjet to the clients site (ai chatbot).