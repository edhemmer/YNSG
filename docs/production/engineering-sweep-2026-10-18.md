# Production engineering sweep — 18 October 2026 UTC

Authority: current owner directions, `AGENTS.md`, production charter/execution/acceptance and the unchanged 28-gate register. Source: production `c1cb8a08996ddaa33a866e83ecc9949f30c461b4` plus PR #113 and this consolidated engineering branch. Reviewer: Codex (engineering review, not independent human acceptance).

## Scope and constraint checklist

The review covers connected customer/account, owner/settings, scheduling, invoice/mail, customer records, mileage, security, native checks and release reliability. R01–R21 remain required; no numeric completion estimate is assigned. Existing [feature inventory](feature-inventory-2026-10-15.md), [traceability](../requirements-traceability.md) and issues [#31](https://github.com/edhemmer/YNSG/issues/31) through [#39](https://github.com/edhemmer/YNSG/issues/39) retain the original scope.

- Approved public copy, logo, services, rates and two-hour minimum: preserved.
- No public redesign, mandatory MFA, Stripe activation, paid provider, new fee or hosting purchase.
- No customer records, messages, bookings, work, invoices, funds or settings manufactured in production for QA.
- Exact attempt/replay, immutable financial history, tenant and current-session permission checks: retained.
- Unknown saves remain distinct from rejected commands and known saves; no ordinary list refresh can prove an exact command outcome.
- Gates requiring owner/device/provider/legal/operator/human evidence stay open. Missing engineering is identified separately below.
- All edited components and their connected API/SQL boundaries reviewed, including late responses, denial, failed reads, duplicate submission and receipt validation.

## Implemented batch and reproducible evidence

| Area / gates | Source and resulting behavior | Synthetic evidence |
| --- | --- | --- |
| Scheduling / WEB-03 | PR #113 included: `apps/web/lib/route-plan.ts` blocks invalid adjacent durations before a provider call | `tests/route-plan.test.ts` |
| Mileage / WEB-08 | `apps/web/app/mileage-activity.tsx`, `apps/web/lib/mileage-contract.ts`, `apps/web/app/api/mileage/route.ts`: refresh preserves uncertain command identity; exact receipts must match trip, action, miles and classification; strict complete reports; duplicate-submit and company-switch guards | `tests/production-workflow-recovery.test.mjs`, `tests/mileage-lifecycle.sql`, `tests/mileage-contract.test.ts` |
| Settings / WEB-01,06,14 | `apps/web/app/company-settings.tsx`: all edits protected before preview; all fields frozen while unknown; successful publish resets the saved baseline; stale company responses ignored; malformed/unavailable reads provide Retry instead of pretending setup is empty | `tests/production-workflow-recovery.test.mjs`, `tests/configuration-api-recovery.test.mjs` |
| Invoice email / WEB-05,07 | `apps/web/app/invoice-delivery.tsx`: synchronous single-attempt guard, strict status/UUID receipt parsing, navigation protection during uncertainty, unchanged serialized replay; accepted provider status does not claim inbox delivery | `tests/production-workflow-recovery.test.mjs`, `tests/invoice-email-owner-recovery.test.mjs` |
| Customer records / WEB-06 | `apps/web/app/customer-delegates.tsx`, `customer-export.tsx`, `customer-import-preview.tsx`: late responses/downloads cannot affect another selection; import preview is bounded, file/navigation locked through uncertainty, receipt counts/revision checked against actual command | `tests/production-workflow-recovery.test.mjs`, `tests/customer-import-atomic.sql`, `tests/customer-delegate-api-receipts.test.mjs` |
| Returning customer / WEB-02,06 | `apps/web/app/account/repeat-request.tsx`: context-read retry; async overview refresh failure retains known request success instead of causing another submission | `tests/production-workflow-recovery.test.mjs`, `tests/customer-repeat-requests.sql` |
| Security / WEB-11 | Read-only hosted catalog review of 11 flagged RPCs confirms no anonymous execution, locked search paths and current `private.staff` guard. `tests/security-command-surface.sql` runs with PGlite and native PostgreSQL fixtures. No grants revoked to hide warnings. | SQL surface assertions plus existing revoked-session, cross-tenant and customer isolation fixtures |

Local release, optimized CRM, native checks and exact-head CI outcomes are recorded in the release PR. No passing result is inferred merely from this document or a source path. No schema changes are included in this batch.

## Current gate disposition — remaining work stays owned

| Gates | Engineering or external work still required |
| --- | --- |
| WEB-01 | Local source inventory reviewed below; published source evidence verified at b8ada287677c2f2778c45b8340faeed0b74d73f9. All implementation/acceptance gaps remain assigned to their original gates. |
| WEB-02–04 | Complete full guest-to-owner synthetic/provider recovery and real device acceptance, including the actual October 19 routing report. A01–A03 were exercised, not signed off. |
| WEB-05 | Invoice/PDF/mail and actual received-funds acceptance; non-Stripe mistaken receipt reversal/credit and broader financial correction remain engineering work under #35. |
| WEB-06 | Delegation management, customer export/import, private files and mileage now have implementations; the older inventory's “missing” labels are historical. Retention/deletion is still incomplete; private-file direct-RPC finalization trust and full job/receipt associations remain engineering review/work under #33/#34. |
| WEB-07 | Controlled inbox receipt, reminder replacement, paused/reconnected provider and ambiguous-send recovery evidence. No live messages sent for this sweep. |
| WEB-08 | Expense/tax/mileage foundations exist. Transaction-level cash/accrual accounting export, reconciliation and QBO sandbox mapping remain engineering work, not merely owner signoff. Actual tax inputs remain WEB-14. |
| WEB-09 | Deterministic packing/briefing exists. Source-backed weather guidance and connected outage/staleness acceptance remain under #36. No paid model or weather provider activated. |
| WEB-10 | Synthetic interaction coverage expanded; actual large text, VoiceOver, iPhone/iPad task timing, performance and accessibility acceptance remain. |
| WEB-11 | Hosted security advisors still report extension-in-public and disabled leaked-password protection, plus informational private tables without policies. Owner RPC warnings are intentional guarded surfaces, not automatically resolved advisories. Independent review and private-file trust boundaries remain. |
| WEB-12 | Actual backup custodian, restricted destination/key custody, retention and accepted RPO/RTO required; production DB-plus-object restore is not replaced by synthetic CI restore. |
| WEB-13 | Controlled alert receipt/failure/recovery, operational handover, rollback rehearsal and commercial hosting eligibility required. No plan purchase authorized. |
| WEB-14–16 | Owner settings/tax/terms/local-search ownership, approved test recipient and real service/funds acceptance remain. No invented approvals. |
| WEB-17 | Exact-head CI, reviewed merge, both deployment SHAs, migration/configuration alignment and read-only smoke; all prerequisite gates required for full web completion. |
| IOS-01,03–08 | Independent human review, actual Apple signing/account inputs, signed device push/auth/share/accessibility/privacy/deletion and TestFlight evidence remain. Native auth/sharing/deletion also contain engineering work. |
| IOS-02 | Native types/lint/SDK/bundle passed locally. Audit reports 2 high and 1 moderate advisories; node-forge GHSA-86w9-cpqp-85rv and braces GHSA-vfj7-8cjw-p6xm show no patched version. Keep distribution blocked; no suppression/unsupported override. |
| SCALE-01–03 | Real second-company onboarding/domain/sender isolation, legal/support decisions, load, recovery and offboarding remain; native and web readiness do not imply SaaS-sale acceptance. |

## Prepared owner verification (when engineering prerequisite is ready)

Use the existing [A01–A14 script](acceptance.md). Start at [owner workspace](https://yourneighborhoodserviceguy.app/owner) and [customer account](https://yourneighborhoodserviceguy.app/account).

1. Review actual company/terms/tax settings in Settings; record decisions and saved versions. Do not enter credentials in chat.
2. On phone/iPad, read a request's complete services, note and local arrival/reserved window. Report the specific action and observed result, especially October 19 routing.
3. After isolated failure tests pass, use only an actual agreed service and actual received funds for completion/invoice/cash/Zelle acceptance; verify the PDF and intended inbox separately.
4. Choose backup custodian/destination/key custody/retention and independent reviewer. Signing, real provider receipts and security acceptance cannot be supplied by code tests.

These are prepared acceptance steps, not a claim that every engineering gap is closed. No repeated approval is required for ordinary authorized fixes, tests, GitHub publication or the reviewed release.

## Inventory acceptance and local results

WEB-01 local source-inventory review: **pass**, engineering reviewer Codex, 18 October 2026 UTC. This reviews the inventory, source/issue mapping and honest integration status only. Published evidence was verified through the GitHub connector at candidate b8ada287677c2f2778c45b8340faeed0b74d73f9; WEB-01 inventory acceptance is recorded separately from implementation gates. It does not accept implementation, device/provider behavior or any other gate. The retained source matrix supplies R01–R21 paths; the current amendment above corrects its stale implementation labels. Remaining omissions are explicitly linked to #32–#39 and the A01–A14 acceptance catalog.

| Requirement coverage | Current source inventory and issue ownership |
| --- | --- |
| R01–R02 | `site/`, `scripts/build.mjs`, governing contracts; WEB-02/10/#37 and WEB-01/#31 |
| R03–R06 | `session.ts`, `company-settings.tsx`, `customer-records.tsx`, `account/repeat-request.tsx`, delegate/file/export/import APIs and canonical SQL; #32/#33/#34/#37/#39 |
| R07–R11 | Pricing/domain, quote/work/invoice/payment contracts, scheduling/reservation/recurrence/route and calendar APIs plus SQL; #32/#35/#36/#37 |
| R12–R13 | Mail workers, immutable outbox intents, invoice/paid templates and consent settings; #32/#37 |
| R14–R15 | Finance/tax/mileage APIs, deterministic briefings/packing; missing reconciliation/weather remain #35/#36 |
| R16–R17 | `apps/mobile/`, native evidence register, responsive/browser interaction checks and physical-device/performance acceptance; #37/#38 |
| R18–R21 | Private storage, session/tenant commands, recovery scripts, integration/platform boundaries, release CI and completion register; #33/#34/#35/#37/#38/#39 |

Final local code checks: `npm run build` passed completion integrity, JavaScript checks, generated contracts, root/CRM TypeScript, **583 tests**, PGlite migration/lifecycle/security-surface assertions, dependency audit (no known browser production vulnerabilities), and all 11 public pages. Optimized Next CRM build passed. The 14 new interaction cases and six connected customer-record cases passed together. Native typecheck/lint/SDK compatibility/iOS bundle passed; native audit remains a failed distribution gate with 2 high and 1 moderate advisories.

The earlier full run exposed three connected customer-editor failures caused by treating a failed delegate-status read as an uncertain mutation. That implementation was corrected, existing assertions retained, and the connected/full suites passed afterward. No test or security check was disabled.

Read-only live baseline: all 11 public pages returned HTTP 200 and did not contain the rejected wording. This is not post-release evidence; the release PR must identify tested head, merge SHA, deployment IDs and subsequent live checks. No production schema change is required.


## Publication and candidate mapping

The original shell push was blocked and later failed for missing shell credentials. The authorized connected GitHub app published the reviewed batch in PR #114 at `b8ada287677c2f2778c45b8340faeed0b74d73f9`. Its full tree `b5a7b415c7dda60b736a51f3f03a6778501461c9` exactly matches the tested local batch `b1ed2ef6440879c7f968bf06d336cfd92b3bcbd1`. Source evidence is now reviewable at that published commit. This documentation/register-only follow-up carries that source inventory forward without code/schema changes. Remote CI, reviewed merge and production validation remain release requirements. PR #113 is included in this consolidated batch rather than deployed separately.
