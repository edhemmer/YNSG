# November 18, 2026 — field guide, website lead focus and Service Saturday

Dated record of the November 17–18, 2026 working session (PRs #333–#337). Current completion authority stays with [the production charter](README.md) and `contracts/production-completion.json`; this file records what shipped, the owner decisions behind it and how to maintain it. No completion gate is closed by this work.

## Shipped

| PR | What changed |
| --- | --- |
| #333 (merged) | Missing service icons (leaf, cleanout, farm hand); services polish and accuracy pass. |
| #334 (merged) | Footer tightened: social chips, grouped links, small legal line. |
| #335 (merged) | Customer service insights moved from Marketing to Customers; per-customer email history (`customer_email_history`, applied to Supabase as history version `20261118132316`); first home repair field guide. |
| #336 (merged) | Field guide expanded to 62 guides with appliances, yard, outdoor, seasonal and accessibility, best practices and JULIE callouts. |
| #337 (open for owner review) | Field guide depth pass to 76 guides with job sheets; website lead focus; Service Saturday moved to January 2027 with a 35-entry minimum; realtor inspection fixes; before/after photos; these docs. No database or migration changes. |

### Field guide (CRM → Learning)

- **76 guides in 18 color-coded categories**: doors, locks, cabinets, walls, floors, tile, faucets and toilets, bath hardware, windows, appliances, electrical basics, mounting, painting, lawn and landscape, fences/decks/concrete, snow and seasonal, accessibility help, safety basics.
- Every guide: symptoms, quick checks, numbered steps the owner can tick off, best practices, trade tricks, tools and parts, a stop-and-refer line and a linked reference. Guides you can do have at least 2 quick checks, 4 steps, 2 trade tricks and best practices (enforced by `tests/home-repair-guides-depth.test.ts`).
- **40 SVG drawings** (43 guides use one); plain SVG in `apps/web/app/repair-diagrams.tsx`, no downloads.
- Callouts: Illinois plumbing "Know the line" on every plumbing guide (225 ILCS 320 minor-repair limit), JULIE 811 "Before you dig" on digging jobs.
- Field use: **Copy job sheet** (pack list, quick checks, steps, stop line as plain text), **Print** (prints only the guide) and related guides.
- Refer-out by design: gas connections, all wiring/fixtures/switches/outlets, garage door springs and cables, plumbing beyond inside-the-fixture parts, roofs and anything above ground level. No gutter work anywhere.

Files:

| File | Role |
| --- | --- |
| `apps/web/lib/home-repair-guides.ts` | Types, categories, scope notes, the original 25 guides, search, and `GUIDES` assembly. |
| `apps/web/lib/home-repair-guides-more.ts` | Appliances, mounting, painting, yard, outdoor, seasonal, accessibility guides. |
| `apps/web/lib/home-repair-guides-extra.ts` | `DEPTH` (added quick checks/steps/tricks/best practices per guide, with `at` to insert a step in order) and `EXTRA_GUIDES` (14 everyday jobs). |
| `apps/web/app/repair-guide-library.tsx` | Search, categories, guide view, job sheet, print, related guides. |
| `apps/web/app/repair-diagrams.tsx`, `apps/web/app/repair-guide.css` | Drawings and styles (light and dark). |

**Adding or changing a guide:** add it to the right file, keep every fact traceable to the linked source, give it a stop-and-refer line, and run `tests/home-repair-guides*.test.ts`. Plumbing guides must be `minor-plumbing` and say "licensed-plumber work in Illinois" in the stop line. Never write "home safety" (use "Accessibility help") or list gutter work. A new drawing needs its id added to `DiagramId` and a quoted key in `repair-diagrams.tsx`. This is owner training material, not public lessons; [verified-howto-education.md](verified-howto-education.md) still governs any public education feature.

### Website lead focus (#337)

- Home hero: shorter lead; trust checks (locally owned in DeKalb, **we reply within one business day**, fair hourly rate with the estimate confirmed before work); "No account needed… Nothing is booked until you approve."
- "Hi, I'm Ed" card with Ed's real front-porch photo wraps the existing welcome audio. Audio file, controls, transcript and autoplay behavior are unchanged.
- Phones: compact service rows (92px photo, two-line description), 6 recent-work photos instead of 9. Page height on a 390px phone: 12,578 → about 10,400px.
- Section order: hero → services and request builder → recent work (with before/after) → Google rating → how estimates work → seasonal offer and Service Saturday → request → FAQ → business partners → service area.
- Seasonal offer: "Get the house ready for the new year", shown through January 31, 2027 (`data-show-until="2027-01-31"`).
- Before/after: real leaf-cleanup photos (job photos 18 and 11, cropped below the house) side by side in Recent work and stacked on phones on the leaf management page.
- Realtors & property managers: "Do your clients need help with their inspection report fixes?" section (everyday items only; licensed-trade items are flagged), hero line and meta description updated.
- Footer labels raised from 13.5px to 14.4px for the readability audit.
- Image sources and edits are logged in `site/assets/services/IMAGE-USAGE.md`.

### Service Saturday (#337)

`site/data/service-saturday.js`: campaign `service-saturday-2027-01` (renamed because there were no entries yet), entries open Nov 17, 2026 and close **Sun Jan 17, 2027**, drawing **Tue Jan 19**, service **Sat Jan 23, 2027**, `minimumEntries: 35`, `finalEntryDate: 2027-03-28`. Official Rules add a "Minimum number of entries" section; the entry page and banner fine print mention the minimum. The owner app shows "X of 35" and disables the first **Draw winner** until 35 entries; `POST /api/marketing-list` returns `BELOW_MINIMUM` (409) for a first draw below the minimum. Procedure: [marketing-list.md](../marketing-list.md#turning-service-saturday-on-and-off).

### Final copy polish and build fix (#337)

- #336 merged but its Vercel build failed on the root typecheck (TS2835, extensionless imports), so production stayed on #335. Fixed with explicit `.ts` import paths; `npm run verify:release` now passes locally end to end. Run the full `verify:release` (not only the web typecheck) before every push.
- Home: removed the duplicate "Tell us about the work" request band; shorter services intro; clearer leaf and cleanout card text; FAQ and service-area wording tightened.
- Service Saturday: "The drawing is soon … before it's too late" replaced with the actual entry and drawing dates; entry question reworded to "If you win, what would you most like help with?"
- Request page: request category shows "Accessibility help" (was "Accessibility & safety"); the side note now points to the call line at the top of the form.
- Small home jobs page: holiday offer replaced with the new-year visit through January 31.
- "folks with disabilities" → "neighbors with disabilities" on About, Estimates and Home Care Plan; services page wording on farm work and the Community Rate corrected.

## Owner decisions recorded

Also added to [governance](../governance.md#november-18-2026--owner-decisions-website-giveaway-and-field-guide).

1. Field guide is a full education and advice center for handyman, landscaping and service work, with drawings, step-by-step instructions, trade tricks, expert advice and best practices, accurate and sourced.
2. Website promise: reply within one business day (Mon–Fri hours).
3. Service Saturday drawing moves to January 2027 and needs 35 eligible entries; if short, extend in two-week steps until March 28, 2027, then end without a drawing and email entrants.
4. Realtor page offers help with inspection report fixes ("let us take a look, see how we can help"), limited to non-licensed everyday items.
5. Leads by source are reviewed in CRM → Snapshot ("Where requests came from", last 90 days). Phone calls count only when logged as a request.

## Evidence (PR #337 head)

- `npm test`: 1,252 pass, 0 fail. Lint (oxlint), web TypeScript, `npm run verify:seo` (28 pages, 981 links) pass.
- `scripts/verify-public-layout.mjs --chromium-only`: 234 checks pass. `scripts/verify-readability.mjs`: 236 cases, no findings.
- Field guide and home page reviewed in a 390px Chromium render (screenshots shared with the owner in chat, not committed).
- WebKit layout run, exact-head PostgreSQL CI and real-device checks were not run in this session.

## Remaining

- Owner review and merge of #337; then verify the deployed SHA on both domains and do a read-only live check (new home page, January Service Saturday dates, realtor section, one controlled test request only with the owner's OK).
- Reviews: the home page shows quotes automatically once `site/data/reviews.json` holds 3 real Google reviews (copied word for word, with permission).
- Update any Service Saturday posts that said December 8.
- Field guide follow-ups suggested, not started: link request tasks to guides; "Reviewed by Ed" mark per guide.
