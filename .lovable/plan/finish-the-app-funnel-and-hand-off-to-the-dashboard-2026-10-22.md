# Finish the app funnel and hand off to the dashboard

## Part 1 — What I build here (Lovable)

Funnel end sends people to their dashboard:
- On the final "Janice is ready" screen, add a **Go to my dashboard** button.
- If the person is signed in, it opens Threads (/dashboard/conversations) directly.
- If not signed in, it opens Sign in / Create account first, then lands on Threads afterward.
- Returning signed-in users who open the app's start page skip the intro and go straight to Threads.
- Nothing on the website, existing dashboard, or the website's onboarding changes. Existing customers see no difference.

Save funnel answers so they aren't wasted:
- The business name and website entered in the funnel are carried into the existing setup so the person doesn't retype them (only filled in where empty — never overwrites a paying customer's settings).

## Part 2 — What you do (outside Lovable)

1. **Publish** so the latest fixes and funnel go live.
2. **Sign up for developer accounts today:** Apple Developer ($99/year) and Google Play Console ($25 one-time). Google needs 12 testers for 14 days before going public, so start that clock early.
3. **Decide app payments:** charge through Apple/Google in the app, or app for existing subscribers only (pay on the website).
4. **Then use Claude** (the "Claude part" I mentioned): once accounts and the payment decision are ready, open this project's code in Claude Code and ask it to wrap the /app screens in a native iPhone/Android shell (Capacitor), add in-app purchase if chosen, and walk you through Xcode/Android Studio signing and store submission. Lovable can't do that packaging step; Claude in a terminal can.

## Technical details
- Edit `src/routes/app.activate.tsx`: add Link button; check session via supabase auth; unauthenticated -> `/auth?mode=signin&redirect=/dashboard/conversations`.
- `src/routes/app.index.tsx`: if session exists, redirect to `/dashboard/conversations`.
- Optional prefill: on dashboard onboarding load, read funnel context from sessionStorage and fill empty business name/website fields only.
