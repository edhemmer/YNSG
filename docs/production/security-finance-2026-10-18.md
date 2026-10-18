# Main-build file verification and receipt correction

Scope: WEB-05/06/08/11, issues #34/#35/#37. No completion percentage or whole-gate acceptance. This batch implements production behavior, separately from the browser practice area.

## File security

The former authenticated finalization RPC promoted a pending upload based on object existence alone. It now refuses direct finalization. The upload API verifies the stored object with the actor's RLS access and computes its exact SHA-256, byte count and image signature before invoking a server-only finalizer. The finalizer checks the original actor, exact live session, current owner/admin membership, frozen MIME/size/hash and object existence. Browser/anonymous roles cannot execute it. No service credential reaches the browser; the server verifier performs one narrowly defined RPC and no table writes or Storage bypass. The existing production service credential is used; no new provider or secret is activated.

A new authenticated metadata RPC includes the frozen digest. The download API rereads the bytes and checks the digest/size/type before creating a 60-second signed link. Existing metadata and objects remain retained; a mismatched object is withheld rather than overwritten. Legacy authorization response shape is unchanged. New reservations and bucket MIME settings match the supported JPG/PNG contract. Signature checks are not an antivirus or full image decoder claim. Full job/receipt associations and retention/account deletion remain separate work.

## Mistaken cash/Zelle receipts

“Correct a mistaken cash or Zelle entry” appears in owner/bookkeeper payment history. The owner selects the original receipt, records a 10–300-character reason and confirms review. The canonical command locks the invoice, checks current permission/finance entitlement, rejects pending checkout and unsupported receipt types, and appends one opposite receipt linked to the original. A unique index prevents a second correction; actor-bound exact-command receipts protect replay. The original receipt, issued invoice, audit and journals are retained. A balanced reversal journal restores receivable and offsets the recorded cash entry. The correction is posted now; prior-period records are not silently rewritten.

This does not transfer money, issue a refund, cancel work or change tax/issued charges. If the earlier entry was wrong, record the correct actual amount separately after reviewing the corrected balance. Invoice credits, actual refunds and broader accounting reconciliation are not claimed implemented.

An unsent paid notice is suppressed when the balance reopens. Subsequent correct settlement reuses only a definitely suppressed milestone; accepted, sending or uncertain delivery is never duplicated or overwritten. Accepted messages cannot be unsent. Original and opposite entries appear distinctly in payment history. The live owner UI blocks conflicting edits while an outcome is unknown and replays the exact frozen attempt. A confirmed correction followed by a failed history read stays confirmed, with a read-only recovery action.

The sample practice area supports the same correction screen with local simulated responses so this UI can be exercised without manufacturing production funds. That is not canonical database acceptance.

## Complete transaction journal export

Money now includes “Download accounting journal CSV” for the selected company business dates. A canonical RPC returns all matching immutable journal lines from one database snapshot, with owner/admin/bookkeeper live access and finance entitlement. Every original and correcting line is included. Date scope is bounded to 366 days; more than 10,000 matching lines is rejected rather than truncated. Client and server validate exact company/range, unique line IDs, local business dates and a balanced complete set of lines per entry before any CSV is downloaded. Dates use the company's timezone; dollar and integer-cent columns remain exact. A tenant/date switch discards late responses.

This is a double-entry accounting export, not a tax return, cash/accrual tax-basis election, reconciliation certification or QuickBooks connection. Dedicated cash/accrual reconciliation and QBO mapping remain under WEB-08/#35.

## Verification and release requirements

- SQL: direct-finalize denial, service-only grant, wrong digest, expired session/revoked membership, one verification audit, frozen digest access; exact receipt replay, changed retry, duplicate correction, original retention, balance/journal reconciliation, paid-notice suppression/re-settlement and cross-tenant denial.
- API/contracts: generated OpenAPI; exact correction identity/negative receipt and ambiguity classification; signed download only after successful byte verification; validated access-token session bound to the authenticated user.
- UI: synchronous duplicate prevention, uncertain-result lock/replay, mismatched receipt retention and confirmed-save/failed-read recovery; existing connected workflow regressions remain required.
- Run full release checks, optimized CRM build and exact-head native PostgreSQL CI. Apply `20261018183156_production_file_verification_receipt_corrections.sql` only after those pass; record the actual hosted migration history and inspect grants/function definitions. During the brief migration-to-app rollout, old upload finalization fails closed; pending attempts can be replayed after deployment. No live QA upload, payment, customer message or invented evidence.
- Verify both production deployment SHAs and read-only health. Actual owner/provider/device/human security acceptance remains open.

Preserved: approved public copy/brand/services/rates, one combined minimum, existing issued snapshots, optional accounts and no required MFA. No Stripe activation, paid resource, real financial mutation or native distribution.

New uploads are limited to 4 MiB in the form, API, reservation and bucket, below the Vercel 4.5 MB request limit including multipart overhead. Existing retained file metadata and verified downloads keep the prior 8 MiB bound. Reference: https://vercel.com/docs/functions/limitations#request-body-size

## Recorded rollout evidence

- Candidate `4e08f6d0a3c7a587ffe50c032362ba4e0f3d4972`: [release checks](https://github.com/edhemmer/YNSG/actions/runs/39156172007) passed, including native PostgreSQL concurrent correction, exact replay and complete dump/restore assertions. Local full build passed 613 tests, SQL assertions, contract/type checks and browser dependency audit; optimized CRM build passed.
- Hosted migration `production_file_verification_receipt_corrections` applied 18 October 2026; actual history version `20261018185446`. Read-only catalog checks confirmed browser finalizer execution false, server execution true, anonymous journal export false, unique correction index present, reservation and bucket upload bounds both 4,194,304 bytes. No production QA payment, upload or customer message was created.
- Security advisor findings remain visible: two private mobile tables with RLS/no policies, public pg_net extension, twelve deliberately authenticated guarded definer RPCs, and disabled leaked-password protection. The added owner-only file metadata RPC accounts for one additional definer finding; its authorization/tenant boundary is covered by SQL tests. These checks do not close independent security or authentication-policy acceptance. Remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Final evidence-only head must pass CI before merging PR #117; both production deployments and read-only endpoints must then be rechecked. Device/visual/provider and broader completion gates remain open.
