

## Per-Agent Voice Picker

Add the ability to pick a different ElevenLabs voice for each agent, save it to the database, and use it whenever that agent speaks.

### What you'll see

- A new **Voice** field in the agent's edit dialog (pencil icon)
- A dropdown of 8 hand-picked ElevenLabs voices, each with a name + short description (e.g. "Sarah — warm female receptionist", "Brian — deep professional male")
- A small **Preview** button next to the dropdown that plays a sample line in the selected voice before you save
- The selected voice is used immediately for all chat replies and (later) for inbound phone calls

### How it works

1. **Database**: add a `voice_id` text column to the `agents` table (nullable, defaults to Sarah). Existing agents keep working without changes.
2. **Voice catalog**: a small constants file `src/lib/voices.ts` lists 8 curated voices with `id`, `name`, `description`, and `gender`. No need to fetch from ElevenLabs — IDs are stable.
3. **Edit dialog** (`dashboard.agents.$agentId.tsx`): add a `Select` for voice + a Preview button that calls the existing `speakText` server function with the chosen `voiceId` and plays the audio.
4. **Chat playback**: `playReply()` already exists — pass `agent.voice_id` to `speakText` so replies use the agent's voice instead of the hardcoded default.
5. **New Agent page** (`dashboard.new-agent.tsx`): also add the voice picker so it can be set at creation time (defaults to Sarah).

### Curated voice list

| Name | Use case |
|------|----------|
| Sarah | Warm female receptionist (default) |
| Jessica | Friendly female, conversational |
| Matilda | Calm female, professional |
| Alice | British female, polished |
| Brian | Deep male, authoritative |
| Will | Friendly male, casual |
| George | British male, refined |
| Liam | Young male, energetic |

### Technical details

- Migration: `ALTER TABLE agents ADD COLUMN voice_id text DEFAULT 'EXAVITQu4vr4xnSDxMaL'` (Sarah). Existing rows backfill to Sarah automatically.
- `Agent` interface gains `voice_id: string | null`.
- `speakText({ text, voiceId: agent.voice_id ?? undefined })` — server already falls back to Sarah when `voiceId` is omitted.
- Preview uses a 1-line sample: `"Hi, thanks for calling {business}. How can I help you today?"`
- No changes needed to `agent-voice.ts` — it already accepts an optional `voiceId`.
- Voice IDs are public ElevenLabs identifiers, safe to store in the codebase.

### Out of scope (future)

- Custom voice cloning (your ElevenLabs Starter plan supports it, but UI for upload comes later)
- Voice settings sliders (stability, style) — using sensible defaults for now
- Wiring voice choice into Twilio inbound calls — that's the next milestone after this

