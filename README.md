# Your Neighborhood Service Guy, LLC

Source for the public website, the owner and customer web app, and the iOS app. Production work is governed by [`AGENTS.md`](AGENTS.md), [`docs/production/README.md`](docs/production/README.md) and the register in [`contracts/production-completion.json`](contracts/production-completion.json). Read those before changing behavior, pricing, service boundaries or branding; the owner's latest instruction wins.

## What is where

| Area | Location | Notes |
| --- | --- | --- |
| Public website | `site/`, `scripts/build.mjs` | Page bodies in `site/pages/*.html` are combined with shared navigation and metadata into `dist/`. Plain HTML, CSS and JavaScript. |
| Website endpoints | `api/*.js` | Vercel Node.js functions: `requests`, `availability`, `appointment-hold`, `address-check`, `transactional-email`. Shared logic is in `lib/`. |
| Owner and customer web app | `apps/web` | Next.js. API routes live under `apps/web/app/api`. |
| iOS app | `apps/mobile` | Expo and React Native. Read `apps/mobile/AGENTS.md` first. |
| Shared code | `packages/domain`, `packages/contracts` | Deterministic pricing, tax and scheduling rules, and the API contracts. |
| Database | `supabase/migrations` | Postgres with row-level security. Canonical commands own approvals, bookings, invoices and receipts. |
| Checks and tooling | `scripts/`, `tests/` | Release gates, SEO and readability checks, recovery tooling. |
| New developer? Start here | `docs/handoff/` | Eight plain-language files: business, scope, architecture, operations, brand, email, SEO, open decisions. |
| Operations and history | `docs/` | Governance, production register, acceptance runbooks and dated evidence. |

`lib/business-identity.js` holds the business name, public phone number and site addresses used by the page build. The phone number is also written directly into many pages and some customer-facing error messages, so search the whole repo for it before changing it.

## How a website request is handled

The request form posts to `POST /api/requests`. The handler checks the origin and body size, drops honeypot submissions, validates every field and the chosen services, and requires a valid hold token for any chosen appointment time. It then asks the CRM guard for a signed rate-limit decision (`lib/website-guard.js`). When `CRM_INTAKE_ENABLED` is `true` the request is saved through `lib/public-intake.js`; otherwise it is forwarded, signed, to the CRM. Only known, customer-safe failures reach the customer. Anything else returns a generic 503 that gives the business phone number.

The form never books an appointment or promises a quote. A held time is a hold, not a confirmation.

## Local development

Requires Node 22.22 or newer and pnpm 11.25.0 (the `packageManager` in `package.json`).

```sh
pnpm install --frozen-lockfile
node scripts/build.mjs      # build the website into dist/ (serve it with any static server)
npm run check               # syntax checks
npm run lint
npm run typecheck
npm test                    # unit and source-contract tests
npm run test:db             # database tests on an in-process Postgres
npm run verify:release      # the full release gate
```

`pnpm-lock.yaml` is the lockfile that CI and Vercel install from. `npm run build` runs `verify:release` first, so a plain build is the full gate, not a quick compile.

Use isolated synthetic data only. Never copy customer contacts, secrets or production financial rows into tests, fixtures, logs or screenshots.

## Environment variables

Every variable the code reads is listed, by name only, in [`docs/production/environment.md`](docs/production/environment.md). A test fails if code reads a variable that is not listed. Never commit values, and never put a secret in browser code.

## Releases

1. Open a pull request. [`release-checks.yml`](.github/workflows/release-checks.yml) runs the release gate against Postgres 17.
2. Merge the tested head only. Native changes also need the separate native gate (`native-release-gate.yml`).
3. Verify the deployed commit, the database migrations by name, and a read-only live check.
4. A tested incremental release is not a completion claim. Milestones are declared only with `npm run completion:gate` and real evidence.

[`production-watchdog.yml`](.github/workflows/production-watchdog.yml) checks the live site on a schedule.

### Deployments

Two Vercel projects deploy from this repository:

| Project | Serves | Root directory |
| --- | --- | --- |
| `ynsg` | The public website | repository root |
| `ynsg-repo` | The owner and customer app | `apps/web` |

The release notes (for example `docs/production/customer-account-2026-10-26.md`) name `codex/crm-workflow` as the production branch. `main` is an older website-only snapshot, so confirm in each Vercel project's Git settings that it is not selected as a production branch; `docs/crm-deployment-recovery.md` records a failed deployment caused by exactly that. `scripts/ignored-build-step.mjs` decides whether a change rebuilds a project (see `docs/production/production-build-selection.md`).
