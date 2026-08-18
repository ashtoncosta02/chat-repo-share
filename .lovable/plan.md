# New Ask Janice landing page

All seven reference sites loaded fine — I pulled them directly, no videos needed. Only `src/routes/index.tsx` (plus small shared bits used by it) changes. Nothing else in the app is touched.

## What stays

- Elite Plan, $97/mo, "Unlimited calls · Setup included · No contracts"
- Full feature list (all 11 items)
- Get started CTA → `/auth?mode=signup`, Sign In in the header
- Contact email hello@askjanice.net, "need more agents" note
- Footer with Privacy / Terms / Refunds
- Current brand colours: lavender-white background, deep slate-violet ink, purple accent (`--gold` token). No palette change.

## What the new page looks like

Long-form marketing page instead of the current three stacked cards. Section order:

1. **Sticky slim header** — wordmark left, nav anchors (How it works, Features, Pricing, FAQ), Sign In + "Start free trial" button right.
2. **Hero** — two-column on desktop: left is headline ("Never miss another customer call"), sub-line, primary CTA + "See pricing", and a trust strip (24/7 · Unlimited calls · Setup in minutes). Right is an animated "live call" mock card — a phone-call panel showing a caller ringing, Janice answering, and transcript lines typing in one after another on a loop, ending with a captured-lead chip.
3. **Logo/stat band** — three or four proof stats (calls answered 24/7, seconds to answer, leads captured, 30-day money back).
4. **How it works** — three numbered steps with connecting line: Connect your number → Train Janice on your business → She answers, books, and follows up.
5. **Features** — bento-style grid built from the existing 11 features: two large feature tiles (voice answering, calendar booking) plus a compact grid for the rest, each with its existing lucide icon.
6. **Use-case row** — short cards for the kinds of businesses this fits (trades/home services, clinics, salons, law/consulting), each with one line of copy.
7. **Testimonial / quote block** — single quote card, purple tinted, using existing customer wording if you give me one; otherwise a neutral "Trusted by local businesses" band with no fabricated quote.
8. **Pricing** — the existing Elite card, restyled as a centered highlighted card with a "Most popular" ribbon, full feature checklist inside, secure-checkout line, money-back line.
9. **FAQ** — accordion (shadcn Accordion) with 6 questions: setup time, does it work with my existing number, what happens if she can't answer, calendar support, cancelling, refunds.
10. **Final CTA band** — full-width purple gradient band, headline + Start free trial + contact email/phone.
11. **Footer** — expanded: wordmark + one-liner, quick links, contact (email + phone), legal links, copyright.

## Motion (the "not made by AI" part)

- Section content fades/slides up on scroll with staggered children (IntersectionObserver-based reveal hook, respects `prefers-reduced-motion`).
- Hero call-mock plays a looping typed-transcript animation.
- Stat numbers count up when they scroll into view.
- Cards lift subtly on hover; CTA has a soft glow on hover.
- All CSS/Tailwind transitions — no heavy animation library added.

## Technical notes

- Rewrite `src/routes/index.tsx` into small sections in `src/components/landing/*` (Hero, HowItWorks, Features, UseCases, Pricing, FAQ, CTABand, Footer, SiteHeader) so the route file stays readable.
- New shared reveal hook `src/hooks/useReveal.ts`.
- Colours/gradients come from existing tokens in `src/styles.css`; if a gradient/glow token is needed I add it as a semantic token there rather than hardcoding hex.
- Existing `PaymentTestModeBanner` and the `useStripeCheckout` / `ELITE_PRICE_ID` CTA behaviour are preserved exactly.
- `head()` metadata kept and slightly sharpened; no other route's metadata changes.
- Mobile-first: hero stacks, bento collapses to one column, sticky header gets a compact menu.

## One thing I need from you

You asked to include a contact phone number, but there isn't one anywhere in the site today. Reply with the number you want shown (and whether it should also be a "call Janice live to hear her" demo line) and I'll wire it into the header CTA area, final CTA band, and footer. If you'd rather not publish one, I'll leave email only.
