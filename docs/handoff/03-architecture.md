# 3. Architecture

```
Browser (customer / prospect)            Browser or iOS (owner, staff)
        |                                          |
  Vercel project "ynsg"                    Vercel project "ynsg-repo"
  static site: site/ -> dist/              Next.js 16 / React 19: apps/web
  + Node functions: api/*.js               + route handlers: apps/web/app/api/*
        \______________________ Supabase ___________________/
              Postgres + RLS + auth + storage + pg_cron/pg_net
        Stripe (card)   Resend (email)   Google (Calendar, Gmail, Maps)
```

## Repository map

| Path | Purpose |
| --- | --- |
| `site/`, `scripts/build.mjs`, `scripts/seo.mjs` | Public site. Page bodies in `site/pages/*.html`; shared nav, footer and metadata assembled by `build.mjs` into `dist/`. Titles, descriptions and schema live in `build.mjs` and `seo.mjs`. `site/polish.css` loads last. |
| `api/`, `lib/` | Website endpoints (requests, availability, appointment-hold, address-check, transactional-email) and shared plain-JS logic, including the email layout. |
| `apps/web` | Owner and customer app. `app/` pages and components, `app/api/` route handlers, `lib/` domain helpers. Styles: `style.css`, `field-system.css`, `premium.css` (last). |
| `apps/mobile` | Expo / React Native iOS app. Read `apps/mobile/AGENTS.md` first. |
| `packages/domain`, `packages/contracts` | Deterministic pricing, tax and scheduling rules; API contracts. `contracts/owner-api.openapi.json` is generated from executable schemas. |
| `supabase/migrations` | About 100 ordered SQL migrations. Never edit an applied migration; add a new one. |
| `tests/` | Unit, source-contract and SQL tests (PGlite for in-process Postgres). |
| `scripts/` | Release gates, SEO checks, recovery tooling, verification harnesses. |
| `docs/` | Governance, specs, dated evidence. `docs/handoff/` is this orientation. |
| `marketing/` | Ad creative, audio, job photos, tools (social content). |

## Key design rules

1. **Database owns state transitions.** Approvals, bookings, invoices, payments and receipts are security-definer commands with actor-bound idempotency and revision checks. UI code calls them through `/api/commands` and similar; it does not write those tables directly.
2. **Row-level security everywhere.** Tenant (organization) isolation and customer-scoped access. Organization UUID for YNSG: `a933d657-14d3-46b6-85e6-21d973e4ed97`.
3. **Deterministic money.** Prices, tax, minimums, caps and balances come from `packages/domain` and SQL, never from a model.
4. **Snapshots are evidence.** Invoices store a snapshot of recipient, scope and tax at issue time. Corrections are explicit credit commands.
5. **Untrusted input.** Same-origin checks, bounded bodies, zod `.strict()` schemas, output escaping in emails (`emailEscape`), URL allowlists for links in email (`https` only, validated hosts for logo and social).
6. **Public failures are generic.** Only known, customer-safe errors reach customers; others return a generic message with the phone number.

## Request lifecycle (website)

`POST /api/requests` validates origin, size, honeypot, fields and services, requires a valid hold token for any chosen time, asks the CRM guard (`lib/website-guard.js`) for a signed rate-limit decision, then saves via `lib/public-intake.js` (when `CRM_INTAKE_ENABLED=true`) or forwards signed to the CRM. The owner is notified by email; the customer receives a confirmation.

## Invoice and payment lifecycle

Visit completed -> invoice draft (pricing from rules) -> owner reviews and issues (number `YYYYMM-####`, snapshot) -> email with PDF (`invoice-message.ts`, `invoice-pdf.ts`) and optional pay link `/invoice?organization=..&invoice=..` -> payment by cash/Zelle (owner records) or card (Stripe Checkout, `api/stripe/checkout`, webhook `api/stripe/webhook`) -> paid receipt email. Card checkout prepares an order in the database first (`prepare_card_payment`), which refuses any amount above the remaining total.

## Email pipeline

Message builders in `apps/web/lib/*-message.ts` and `lib/*-email.js` produce subject, plain text and HTML using `lib/email-layout.js`. Messages are queued in an outbox and sent by workers through Resend (`lib/transactional-email.js`, `apps/web/app/api/mail-transport`) or Gmail when enabled. See doc 6.

## Scheduled work

Vercel cron: `/api/field-agent/worker` daily. Supabase `pg_cron` plus `pg_net` call background workers every minute (outbox, calendar sync, reminders). Setup SQL is in `scripts/setup-background-*.sql`; health and failure alerts are in `docs/background-automation-acceptance.md`.
