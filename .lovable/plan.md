# Unread/Read indicator on Threads

Add a small pill badge (styled like the existing "Recording" chip, placed to its left) on each thread card in `src/routes/dashboard.conversations.index.tsx`:

- **Unread** — filled purple accent (like `Recording` but solid), for threads never opened.
- **Read** — muted gray outline, for threads already opened.

Clicking into a thread flips its state to "Read".

## Storage approach

Track read state **per-user in `localStorage`** keyed by user id:
- Key: `askjanice.threads.read.<userId>`
- Value: JSON `{ [conversationId]: ISO timestamp }`

Rationale: no schema change, instant UI, and works across the mixed voice/chat/SMS thread list without touching the messages table. A thread is considered **unread** if its `started_at` (or last activity, when available on the row) is newer than the stored read timestamp, or if it has no stored timestamp at all.

## Changes (frontend only)

1. **`src/routes/dashboard.conversations.index.tsx`**
   - Add a small `useReadThreads(userId)` hook (inline in the file) that loads the map from `localStorage` on mount and exposes `isUnread(convId, activityAt)` and `markRead(convId)`.
   - Render a new badge to the immediate **left** of the existing `Recording` chip on each card, matching its size/shape:
     - Unread: solid gold/purple background + white text, dot icon.
     - Read: muted border + muted-foreground text.
   - Call `markRead(conv.id)` in the card's click/`Link` handler (also on "Call back" / open actions so the state updates without waiting for a route change).
   - Keep sort order unchanged.

2. **`src/routes/dashboard.conversations.$conversationId.tsx`**
   - On mount, also call the same `localStorage` writer (small shared helper — either duplicated or extracted to `src/lib/thread-read-state.ts`) so opening the detail page directly (deep link) also marks it read.

## Out of scope

- No DB column, no server function, no notification changes.
- No new "Unread" filter in the toolbar (can be added later if the customer asks).
