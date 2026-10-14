# YNSG engineering controls

Read `docs/governance.md` and `docs/engineering-spec.md` before changing business behavior. The owner's latest instructions have precedence. Preserve existing pricing, service boundaries, brand and customer changes.

## Contract and authority

- Define and review bounded input/output contracts before adding APIs. `contracts/owner-api.openapi.json` is generated from executable schemas; run `npm run contracts:check` to detect drift.
- Postgres canonical commands own approvals, bookings, timers, invoices and receipts. Require current organization permissions, exact revisions, actor-bound idempotency and explicit customer/owner evidence. Never invent consent, work, tax approval or funds.
- Original submissions and issued financial snapshots are retained evidence. Correction needs an explicit command and audit; arbitrary table edits are prohibited.
- AI output is untrusted proposed data. It cannot bypass permissions, approval gates or deterministic pricing/tax/calendaring. No paid model activation without an approved provider and budget.

## Validation and release

- Use isolated synthetic fixtures. Never copy customer contacts, secrets or production financial rows into staging, tests, screenshots in a public PR, or logs. Production walkthroughs are read-only unless the owner authorizes a specific real action.
- Run `npm run verify:release` and required native PostgreSQL CI for browser/database changes. Native changes require typecheck, lint, SDK compatibility, iOS bundle and separate native security audit. Keep unresolved native advisories as release gates; never suppress them to make CI green.
- Test races, stale revisions, interrupted responses, same-command replay and tenant revocation at consequential boundaries. A successful build is not physical-device or provider-delivery evidence.
- Publish a PR with problem, resulting behavior, evidence and remaining gates. Merge the tested head only. Verify deployment SHA, database migration by name and live read-only flow.
- Before native distribution, obtain an independent human review of authentication, database permissions, financial transitions and push privacy. Record reviewer, exact commit, findings and resolution; AI review is not human evidence.

## Native requirements

Read `apps/mobile/AGENTS.md`. No tokens through JavaScript bridges; the optional typed bridge carries only appearance and explicitly requested device notification registration. No bridge commands for business mutations, payments, file URLs or arbitrary navigation. Notifications are optional, use generic lock-screen text, and authenticate every destination. Apple signing, APNs credentials, privacy declarations, account-deletion behavior, device accessibility and TestFlight remain separately evidenced gates.
