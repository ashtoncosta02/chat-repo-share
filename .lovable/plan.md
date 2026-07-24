## Problem

`NewVersionBanner` is mounted in `src/routes/__root.tsx`, so it renders on **every** route — including `/widget/$agentId`, which is what your customers see embedded on your website. When a new deploy shipped, your visitors saw a big lime "A new version is available — Refresh" bubble floating over the chat widget.

That banner is meant only for you/your team inside the dashboard, never for end customers.

## Fix

Scope the banner to dashboard routes only. Two small changes:

1. **`src/components/NewVersionBanner.tsx`** — gate rendering on the current path. If it doesn't start with `/dashboard`, render nothing. Use `useRouterState` from `@tanstack/react-router` so it reacts to navigation.

2. **`src/routes/__root.tsx`** — no structural change needed; the banner stays mounted globally but self-hides everywhere except `/dashboard/*`.

Result:
- You + admins still get the refresh prompt inside the dashboard after a deploy.
- The public chat widget (`/widget/$agentId`), auth pages, marketing/legal pages, and anything else outside `/dashboard` never show it.
- Customers on your website see a clean widget — no refresh button, no version chatter.

## Technical details

- Use `useRouterState({ select: (s) => s.location.pathname })` inside `NewVersionBanner`; early-return `null` when the pathname doesn't start with `/dashboard`.
- Keep the polling/visibility logic as-is so the banner appears immediately once an admin navigates into the dashboard after a deploy.
- No changes to `getLoadedAssetHash` (still used by the Admin build-version card).