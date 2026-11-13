# 04. Operations: accounts, deploys, environment, shipping safely

Last updated: November 13, 2026.

## Where things live

| Thing | Where | Notes |
| --- | --- | --- |
| Code | GitHub `edhemmer/YNSG` | Production branch is `codex/crm-workflow`. `main` is an old website-only snapshot. |
| Public website | Vercel project `ynsg` | Serves `www.yourneighborhoodserviceguy.com`. Built from `site/` by `scripts/build.mjs` into `dist/` (`vercel.json`). |
| Owner and customer app | Vercel project `ynsg-repo` | Serves `yourneighborhoodserviceguy.app`. Next.js in `apps/web`. |
| Database and auth | Supabase project `jvigtwjlkmeyavzbxjzl` | Postgres with row-level security. Migrations live in `supabase/migrations`. |
| Email sending | Resend | Transactional and owner messages. See [06](06-email-and-invoices.md). |
| Card payments | Stripe Checkout | Merchant configuration is in `STRIPE_MERCHANTS_JSON`. A PNC merchant decision is still open ([08](08-open-decisions-and-roadmap.md)). |

## Environment variables

The complete, test-guarded inventory (names only, never values) is [`docs/production/environment.md`](../production/environment.md). Do not duplicate it here. Groups to know:

- **Supabase:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (secret, server only).
- **Email:** `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, `REQUEST_FROM_EMAIL`.
- **Payments:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MERCHANTS_JSON`.
- **Google:** OAuth client id and secret, token encryption key, worker secret, and the `GOOGLE_*_ENABLED` flags.
- **Feature flags:** `CRM_INTAKE_ENABLED`, `PUBLIC_AVAILABILITY_ENABLED`, `REQUEST_LEAD_SOURCE_ENABLED`, `PUBLISH_HOME_CARE_PLAN`, `OWNER_PUSH_ENABLED`, `YNSG_AI_ENABLED`.

Adding a new variable in code fails `tests/environment-inventory.test.mjs` until it is listed in that inventory. That is intentional.

## Local development

```
npm install                      # repo root
cd apps/web && npm install       # owner app
npm run build                    # website: builds site/ into dist/, then SEO checks
cd apps/web && npx next dev -p 3111
```

`next dev` writes an `AGENTS.md` into `apps/web`. Delete it before committing. Use isolated synthetic data only. Never copy customer rows into tests, screenshots or logs. The owner app has a sample sandbox at `/owner/practice` (nothing in it is real).

## Checks before any pull request

- `npm run check`, `npm run lint`, `npm run typecheck`, `npm --prefix apps/web run typecheck`
- `npm test` (about 1,200 tests, mostly source-contract and behavior tests)
- `npm run verify:seo` for website changes (builds, then checks metadata, links, sitemap, schema)
- `npm run contracts:check` if an API schema changed
- `npm run completion:check`. The completion gates in `contracts/production-completion.json` (WEB, IOS, SCALE) intentionally block completion claims, not ordinary releases.

## Release process

1. Branch from `codex/crm-workflow`, bundle related changes into one pull request, include problem, behavior, evidence and remaining gates.
2. CI runs. The owner reviews and merges the pull request himself. Do not merge for him.
3. After merge, Vercel deploys both projects. Verify the deployed SHA and a read-only live flow. Database migrations are applied by name through the Supabase tools; confirm with `list_migrations`.
4. Database changes: write a migration, test it, apply it, record it. Never edit financial tables by hand. Corrections go through explicit audited commands.

## Monitoring and recovery

- Vercel runtime logs and Supabase logs and advisors are the first stop.
- Supabase Free has no automatic backups. Recovery is the encrypted recovery bundle (`scripts/recovery-bundle.mjs`, `scripts/capture-recovery.mjs`). Its design is in [`docs/production/encrypted-recovery-bundle-2026-10-18.md`](../production/encrypted-recovery-bundle-2026-10-18.md). A backup schedule is an open item ([08](08-open-decisions-and-roadmap.md)).
- Account and data retention rules: [`docs/production/account-deletion-retention.md`](../production/account-deletion-retention.md).

## Cost register (hard rule: everything stays free unless the owner approves first)

The authoritative register is [`docs/cost-dependencies.md`](../cost-dependencies.md) (dated September 30, 2026; recheck prices before relying on it). Summary of the rule: no paid upgrade, paid API, paid AI provider or paid connector is activated without the owner's explicit yes. Warn at 70, 85 and 95 percent of any free allowance. No artificial keep-alive traffic. Vercel Hobby is for non-commercial use, and commercial eligibility was an open question when the register was written; confirm with the owner before assuming it is settled.

## Test and sample data

Synthetic records are labeled and purged only when the owner says "purge". Never purge on your own initiative.
