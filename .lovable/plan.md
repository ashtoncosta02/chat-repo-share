# Avoid Google OAuth verification denial this time

## What Google denied last time
1. **"Your home page does not explain the purpose of your app"**
2. **"The app name 'Ask Janice' configured for your OAuth consent screen does not match the app name on your home page"**

You already fixed the consent screen app name to **Ask Janice** and rebuilt the landing page. The remaining risk is that the current homepage shows the brand name as a small sub-label above the headline, and the header shows only the logo with no text. A Google reviewer scanning quickly could miss the match.

## Plan

### 1. Make the homepage branding unambiguous
Update the landing page so **"Ask Janice"** is clearly readable above the fold and matches the OAuth consent screen app name.

- Add the wordmark **"Ask Janice"** next to the logo in the sticky header (or make the hero headline explicitly start with "Ask Janice" as the product name, not a small subtitle).
- Keep the existing hero copy that explains what the app does: "AI receptionist for local business" / answers calls 24/7, captures leads, books appointments.
- Ensure the logo + product name combination is visible immediately on both desktop and mobile.

Files to touch:
- `src/components/landing/SiteHeader.tsx`
- `src/components/landing/Hero.tsx` (if header change alone is not enough)

### 2. Add an explicit "What Ask Janice does" anchor early in the page
Google reviewers look for a clear description. The current hero already explains it, but we can reinforce it with a short 2–3 sentence summary at the top of the hero and a dedicated "What is Ask Janice?" line in the How it works section.

- Keep the existing tagline and hero description.
- Ensure no other app name (e.g., a parent company name) appears more prominently than "Ask Janice" on the homepage.

### 3. Create a Google OAuth resubmission kit
Before you re-record and resubmit, produce a consistent set of assets/text that Google expects:

- **Updated demo video script** (2–3 minutes) that:
  - Opens on the live homepage with the **Ask Janice** logo/name clearly visible.
  - States: "This is a demo of Ask Janice, an AI receptionist for local businesses."
  - Shows sign-in, the Google Calendar connect button, and the consent screen.
  - Explains why the calendar scope is needed: "to check availability and book appointments on the user's behalf."
  - Shows the booking actually working inside the dashboard.
- **Scope justification text** ready to paste into the submission form:
  - `calendar.events` — "Ask Janice needs to read the user's Google Calendar to check availability and create appointment bookings on their behalf."
  - `userinfo.email` / `openid` — "Used to identify the signed-in account and link calendar data to the correct user. No data is shared."
- **Publishing-status checklist**:
  1. Move app out of Testing (Publish App).
  2. Confirm App name = **Ask Janice**.
  3. Confirm logo uploaded and matches site logo.
  4. Confirm Authorized domains include `askjanice.net` and `www.askjanice.net`.
  5. Confirm Authorized redirect URIs include the current production callback URL.
  6. Submit for verification and reply to Trust & Safety with the new video link.

### 4. Verify the published site before recording
After making the homepage change, publish the site and check that:
- The published homepage at `https://askjanice.net/` shows **"Ask Janice"** clearly above the fold.
- No other product/company name is shown more prominently.
- The hero text explains the app's purpose in one sentence.
- The privacy policy and terms pages are linked from the footer and mention "Ask Janice".

### 5. Optional safety net
If Google rejects again for domain/business-name mismatch, we can add a simple footer line: "Ask Janice is a product of [your legal entity]" — but only add this if needed, because the priority is matching the OAuth app name exactly.

## Expected result
A homepage where **Ask Janice** is the dominant brand name, with a clear explanation of the app's purpose, plus a ready-to-use resubmission script and checklist. This directly addresses both previous denial reasons.
