## Goal

Replace the long flat form (Services / Pricing notes / Booking link + Emergency number / Escalation triggers) on `dashboard.knowledge.tsx` with the same card + drilldown pattern already used for **FAQ** and **Scenario**, so the top of the page stays clean and everything is behind a click.

## New top-level layout

Under **Context**, show a single responsive grid of clickable cards (same visual style as the existing FAQ / Scenario cards — icon, title, small summary chip, chevron):

- FAQ *(unchanged)*
- Scenario *(unchanged)*
- **Services** — chip shows count of lines (e.g. "5 items")
- **Pricing** — chip shows "Set" / "Not set"
- **Booking & Contact** — groups Booking link + Emergency number; chip shows how many of the 2 are filled
- **Escalation triggers** — chip shows count of lines

Nothing else is visible until a card is opened. "Save changes" and the sticky bar are removed from the top view.

## Drilldown behavior

Match the existing FAQ/Scenario drilldown:

- Clicking a card swaps the main panel to that section's editor (same `view` state machine already in the file).
- Each drilldown has: back button, section title + short helper text, the relevant field(s), and a **Save** button scoped to that section only (calls the same `updateAgent` mutation with just those fields, then returns to the card grid).
- Unsaved-change indicator on the Save button (disabled until dirty), matching current FAQ/Scenario behavior.

## Cards → fields mapping

| Card | Fields edited | Chip label logic |
|---|---|---|
| Services | `services` (textarea) | `${nonEmptyLines} items` or "Empty" |
| Pricing | `pricing_notes` (textarea) | "Set" if non-empty, else "Not set" |
| Booking & Contact | `booking_link` + `emergency_number` (two inputs) | "2 of 2" / "1 of 2" / "Not set" |
| Escalation triggers | `escalation_triggers` (textarea) | `${nonEmptyLines} triggers` or "Empty" |

## Out of scope

- No schema changes, no server-fn changes, no copy rewrites beyond the small chip/helper text.
- FAQ and Scenario cards + flows untouched.
- Mobile layout inherits the existing responsive grid used by FAQ/Scenario.

## Technical notes

- Single file: `src/routes/dashboard.knowledge.tsx`.
- Extend the existing `view` union (currently `"root" | "faq" | "scenario"`) with `"services" | "pricing" | "booking" | "escalation"`.
- Reuse the existing card component/markup used for FAQ/Scenario so styling stays identical.
- Reuse the existing `useMutation` for `updateAgent`; each section's Save sends only its fields.
