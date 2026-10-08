# Stop repeated website-chat transcript emails

## What happened
Paul Kinsman's website chat with Costa Caulking (started Oct 7) was emailed over and over. When a transcript is sent, the chat is stamped "notified at" — but saving that stamp also bumps the chat's "last updated" time a few milliseconds later. The resend check ("chat updated after last notice = visitor resumed") then thinks the visitor came back, so every sweep (each new website chat message anywhere, plus the 15-minute backstop) sent the same transcript again. Data confirms: last updated 15:00:09.786, notified 15:00:09.748.

## Fix
1. Decide "visitor resumed" from the newest visitor/assistant message time, not the chat's "last updated" time. Only resend when a message exists that was created after the last notice.
2. Add a small safety margin so a message saved in the same instant as the notice isn't counted.
3. Leave first-time sends, the 4-minute quiet wait and the 2-message minimum unchanged.

## Verify
- Re-run the check against Paul Kinsman's chat: it should no longer qualify.
- Confirm no other chats currently qualify falsely.

## Technical details
- `src/server/widget-chat-digest.server.ts`: for each candidate with `notified_at`, query latest `widget_messages.created_at`; include only if `> notified_at + 2s`. Use that latest message time (not `updated_at`) for the 4-minute idle cutoff too.
- Root cause: `update_updated_at_column` trigger on `widget_conversations` fires on the `notified_at` claim update in `widget-thread-mirror.server.ts`.
