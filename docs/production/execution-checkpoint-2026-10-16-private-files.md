# Execution checkpoint — 2026-10-16, private customer files / WEB-06

Controlling references: `AGENTS.md`, `docs/governance.md`, `docs/production/README.md`, `docs/production/execution.md`, `docs/production/acceptance.md`, `contracts/production-completion.json`, and issue [#34](https://github.com/edhemmer/YNSG/issues/34). This checkpoint supplements—not replaces—the 28-gate register.

## Scope and state
- Baseline merged branch `codex/crm-workflow` at `f26e5a0511ac1e5e8c563f28ca799f5c9d396347`. This branch: `codex/private-customer-files-lifecycle`, PR [#87](https://github.com/edhemmer/YNSG/pull/87). PR head should be read dynamically; never infer it from this checkpoint.
- Implemented *candidate code*: private object metadata and access-control SQL; isolated Storage fixture; owner/customer-scoped reservation/list/finalization/read RPCs; JPG/PNG signature and size validation; customer attachment UI/API; retry-uncertainty lock; object path identity tests.
- Not yet accepted: PDF handling, job-level attachment association, verified object byte hash on completed upload, private-object backup/restore, retention/deletion/legal hold, storage privacy threat review, device upload, API end-to-end and two-tenant tests. Do **not** close WEB-06 or #34.
- Database migration `20261016201500_private_customer_supporting_files.sql` is **pending**, not applied to connected production Supabase. Do not deploy without green exact-head CI and review of Storage policy safety. No customer data uploaded to production.
- First PR CI failed in native PostgreSQL runner because `scripts/verify-postgres.mjs` contained a malformed source newline after adding Storage fixtures. Corrected in commit `8a313466309cb28a3f0c77027fd783b507f48441`. The next run must complete successfully; do not merge on a pending/failed run.

## Resume execution
1. Get exact PR #87 head and all GitHub workflow job logs. Repair errors until both `contracts-browser-and-native-foundation` and `postgres-lifecycle-and-recovery` succeed at **the identical PR head**. Keep `scripts/check-migration-history.mjs` aligned with the pending migration entry.
2. Verify native Postgres isolated storage fixture, role/RLS and two-tenant unauthorized read, upload and replay. Confirm uploaded image bytes/hash, not just object existence. Ensure negative cases fail closed. Implement needed corrections and rerun tests.
3. Apply the reviewed migration to Supabase once safe; record actual observed Supabase migration version in `contracts/migration-history-map.json`, then rerun exact-head CI.
4. Merge only tested head to `codex/crm-workflow`; verify both Vercel deployment SHAs and read-only health. Update #34 and the production evidence ledger; do not mark gate accepted without full runbook cases and authorized device/human evidence.
5. Continue the next unblocked WEB-01/WEB-06 dependencies (private backup/files; customer lifecycle) and then the remaining 28-gate register.

## Standing invariants
No invented customer files, consent, funds, invoices, or recipient email. Existing price `$60/$45` and single combined 2-hour hourly visit minimum unchanged. No live Stripe payments or native iOS release. No gate shrinkage or false completion. Never treat CI as independent human/device evidence.
