# Google OAuth Verification Appeal Plan

## What Google is rejecting
1. **"Your home page does not explain the purpose of your app."**
2. **"The app name 'Ask Janice' configured for your OAuth consent screen does not match the app name on your home page."**

The homepage currently explains the purpose in the hero paragraph, but the app name "Ask Janice" is only a small label above the main headline and is not visible in the sticky header at all. Google reviewers look for the OAuth app name displayed clearly on the homepage.

## Plan

### 1. Make "Ask Janice" unmistakable on the homepage
- Update `SiteHeader.tsx` to show the wordmark "Ask Janice" next to the logo (large enough to read).
- Keep the design clean and professional.
- Ensure the wordmark is visible on both desktop and mobile.

### 2. Strengthen the purpose statement above the fold
- Update `Hero.tsx` so the main headline and sub-headline explicitly state what the app does in plain language.
- Keep the existing purple/gold brand colours.

### 3. Publish the site
- Deploy the updated homepage to the live custom domain so the Google reviewer sees the changes.

### 4. Provide appeal-form copy
After publishing, give you the exact dropdown selections and explanation text to paste into the two appeal fields in Google Cloud.

## Expected outcome
Google's reviewer sees "Ask Janice" clearly on the homepage and immediately understands the app is an AI phone receptionist, resolving both noncompliant items.
