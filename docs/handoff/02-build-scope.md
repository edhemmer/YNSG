# 2. Build scope ledger

Status as of November 12, 2026. "Working" means built, tested in CI and in use or ready to use in production. "Open" means not yet accepted. The formal register is [`contracts/production-completion.json`](../../contracts/production-completion.json) (gates WEB-01..17, IOS-01..08, SCALE-01..03); validate it with `npm run completion:check`. A tested incremental release is not a completion claim.

## Public website (`site/`) - working

- 24 pages: home, services, pricing, service area, request, about, careers, privacy, terms, service agreement, accessibility, plus service landing pages (lawn mowing, mulch delivery and spreading, mulch and yard cleanup, leaf cleanup, snow removal, concrete washing, cleanout, farm hand, small home jobs at `/handyman-dekalb-il`, accessibility home safety, realtors and property managers, home care plan).
- Request flow: Services, Time, Details stepper. Free address check. Time holds (a hold is not a booking). Interrupted-send recovery. Honeypot and rate limiting through a signed CRM guard.
- Local SEO: schema.org, per-page titles and descriptions, sitemap (24 URLs), robots, checks (`check-seo.mjs`, `check-local-seo.mjs`, `check-live-indexability.mjs`).
- Light and dark themes, mobile polish, readability gate (`verify-readability.mjs`).

## Owner and customer web app (`apps/web`) - working

| Area | State |
| --- | --- |
| Sign-in, MFA, owner invitation, session revocation | Working |
| Request inbox: approve, decline (with templated explanation), reschedule, cancel | Working |
| Calendar: month and day, availability, blocks, buffers, recurring series, route and travel time, delay notices | Working |
| Customers and properties: search, edit, history, notes, imports and exports | Working |
| Job workflow on a phone: open, confirm, clock, complete, invoice | Working |
| Invoices: draft, review, monthly numbering `YYYYMM-####`, snapshot, PDF, email, credits and corrections | Working |
| Payments: cash and Zelle receipts, split payments, balance math, card payments through Stripe Checkout | Built; live card use waits on the processor decision (see doc 8) |
| Card payment guard: no card charge when balance is zero or would be exceeded | Working (PR #312) |
| Expenses, mileage, reports, CSV export, federal and Illinois tax helper | Working |
| Daily guidance: "today" briefing, supply readiness, route readiness | Working |
| Google integration: Calendar free/busy and event sync, Gmail send (optional), Maps | Built; owner connects accounts |
| Email: shared branded layout, 48 manual templates, automatic messages | Working (PR #311) |
| Careers and field labor (applications, team roles) | Working |
| Practice sandbox with sample data at `/owner/practice` (no sign-in) | Working |
| Premium visual layer (`premium.css`), dark and light themes, brand palette | Working (PR #310 pending merge) |

## Not built or not accepted

- **iOS app (`apps/mobile`)**: code exists; not through Apple signing, TestFlight or App Review. Gates IOS-01..08 open; IOS-02 blocked by native audit findings.
- **Automatic review requests** after a paid job, and **automatic unpaid-invoice reminders**: templates exist, scheduling not wired.
- **Card processor live**: PNC merchant services under evaluation. Stripe code path exists but live activation and fee disclosure wording are pending the owner.
- **Customer file/photo upload workflow**: partially built (private file routes exist); not fully accepted.
- **Credit-aware card check**: the database overpayment check compares payments to the invoice total and does not subtract credits.
- **Franchise/second-company onboarding** (SCALE-01..03): foundations only.
- **Real-world acceptance runs** (WEB-14, 15, 16): need the owner to supply real company facts, verify Google Business Profile and Search Console, and run the supervised runbook.
- **Backups** (WEB-12): custodian, destination and retention not chosen.
- AI features exist behind `YNSG_AI_ENABLED` and are off. No paid model activation without an approved budget.

## Explicit scope boundaries (do not add)

Light hanging, insurance-claim work, a "no trip charges" promise, a referral reward, and the word "handyman" in customer copy (use "small home jobs"). See doc 5.
