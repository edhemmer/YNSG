# Production execution checkpoint — 2026-10-16

Authority: `AGENTS.md`, `docs/governance.md`, `docs/production/{README,execution,acceptance}.md`, `contracts/production-completion.json`. Branch: `codex/crm-workflow`. Do not substitute this checkpoint for full gates.

## Last verified release baseline
- Merged branch at start of this batch: `f26e5a0511ac1e5e8c563f28ca799f5c9d396347`.
- Vercel project `ynsg` (.com) and `ynsg-repo` (.app) both reported READY at that SHA.
- Supabase migration history and 28-gate register require fresh exact-head reconciliation before subsequent release.

## In-flight work
- PR #87 `codex/private-customer-files-lifecycle`: WEB-06/#34 private storage metadata, owner-only image upload/list/signed-read API and customer record UI, Postgres Storage test fixtures; this is not yet merged and must not be applied to production without passing exact-head CI plus security review.
- New SQL `20261016201500_private_customer_supporting_files.sql` explicitly pending/unapplied in `contracts/migration-history-map.json`.
- CI run `38948099569` failed because `scripts/verify-postgres.mjs` had a multiline JavaScript double-quoted string at the storage bootstrap. Repair committed to PR branch at `efa80cc154871f5482799b028dab2620517191bb`; exact-head run `38948266795` pending at checkpoint.

## Security and acceptance issues to finish
- Ensure storage bucket/object policies correctly authorize INSERT and SELECT with owner scope; check anonymous, cross-org, customer-delegate and revoked-owner paths.
- Inspect actual object MIME/signature, size/hash and replay behavior: current finalize checks object presence only, and does not yet prove uploaded blob matches metadata SHA/length. Do not label this fully secure until fixed or verified.
- Confirm private file restore covers object bytes and hashes, not only database rows.
- Verify signed URL origin/path and no premature signed URL from failed uploads. No customer files used for marketing.
- Complete end-to-end job/receipt association, retention/deletion decision and physical device proof before WEB-06 gate verification.
- Continue #33 export/retention, #35 mileage/report/export, #36 provider outages/weather, #39 SaaS and #37 human/device/security acceptance; Stripe live activation and native distribution are explicitly deferred exceptions, not grounds to skip independent foundations.

## Resume exact executable actions
1. Fetch PR #87 latest head and exact-head CI logs for run 38948266795; repair tests/code failures without weakening checks.
2. Fix verification gaps (metadata-object digest enforcement, malicious upload, replay, role revocation, cross-tenant) with synthetic Postgres fixture and API tests.
3. Merge only after both required exact-head CI jobs pass, then verify matching Supabase migration name/DDL and .com/.app deployment SHAs.
4. Update this checkpoint and requirements/evidence register. Continue next unblocked work; never mark any of 28 gates verified without the `requiredEvidence` and original acceptance cases.
