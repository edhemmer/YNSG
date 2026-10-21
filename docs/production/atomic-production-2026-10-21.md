# Atomic production review — October 21, 2026

Scope: current `codex/crm-workflow`, production website/CRM and all 28 retained completion gates. Read before implementation: active owner directives, AGENTS.md, governance, engineering specification, completion charter/execution/register, acceptance cases, feature inventory, open GitHub issues and current source. No native distribution or paid activation is authorized by a web maintenance release.

## Pass/fail checklist

- Preserve every required gate and R01–R21; no fabricated human, inbox, physical-device, funds, tax, legal or backup acceptance.
- Preserve official branding, public approved CTA, pricing/minimums, lawful service boundaries, optional accounts, recovered authentication, tenant permissions and customer data.
- No Google login, required MFA, live Stripe, paid model activation or unauthorized production test messages.
- Browser navigation and deep links restore the authorized company, section and selected record; Back/Forward cancellation retains history and drafts; focus/session renewal cannot reopen an old link.
- Session revocation removes protected records; late reads cannot restore another company or expired session; valid session renewal retains the current workflow.
- Field money screen prioritizes balances and invoice actions; expenses, mileage, payment history and secondary administration remain available without mandatory long scrolling.
- Reminder scheduling and worker health checked read-only; provider acceptance and actual inbox delivery reported separately; no real bookings/payments manufactured for QA.
- Synthetic browser behavior, permission/role/history cases, responsive layout, full release checks, builds and required native PostgreSQL CI pass before merge.
- One cohesive implementation commit and reviewable PR; merge only the tested head; verify deployed SHA/aliases and read-only production smoke.
- Entire diff and connected workflow reviewed against this checklist; uncertain or external gates remain explicitly open with concrete next actions.

## Baseline evidence

Source `90add9966a78f50d45fe4fd1592e8df4ed399aad`: 883 application tests, PGlite migration/lifecycle assertions, contracts, root/CRM types and production dependency audit passed locally. The register reports WEB 1/17, IOS 0/8, SCALE 0/3 accepted; these counts are not implementation percentages. Production has active one-minute mail/calendar cron jobs. Activation is not actual reminder inbox receipt.

## Current findings

- Session rechecks reapply the initial URL and use an old render closure; background focus can reopen a deep link and retain a revoked company.
- Canceling browser Back overwrites the destination entry instead of restoring the current history position; Forward can lose its destination.
- Company selection does not serialize its company or clear all record parameters; record reload can use the previous page or request.
- Money opens expense and mileage entry forms before the invoice list and expands every invoice action, causing unnecessary field scrolling.

Implementation and final validation evidence are recorded below after execution. Full gate acceptance remains blocked until the register's actual required evidence exists.

## Gate inspection and concrete remaining acceptance

All 28 original gates and their dependencies remain. `npm run completion:report` now displays every gate rather than hiding downstream gates; add `-- --json` for a complete machine-readable view. Historical verification on WEB-01 remains tied to its published candidate; no current-candidate carry-forward is invented.

| Gates | Remaining evidence/action | Entry point / prepared procedure |
| --- | --- | --- |
| WEB-02–04, WEB-10 | Full customer-to-owner device/provider journeys, route and recurrence recovery, actual phone/iPad usability, task timing and accessibility | `/request`, `/owner`, isolated `/owner/practice`; A01–A06/A12 in acceptance.md. This update adds full-shell behavioral and responsive browser tests. |
| WEB-05, WEB-07 | Current invoice/PDF, actual authorized recipient inbox, 24-hour reminder receipt/replacement, actual received cash/Zelle | A05–A08; no synthetic production funds or customer messages. Minute workers currently succeed. |
| WEB-06 | Customer/device account claim/recovery, delegation/private file/export/deletion acceptance and actual retained-record policy | Customer `/account`, owner Customers and Settings; A09/A10. |
| WEB-08, WEB-14 | Actual company/tax/terms/retention decisions, accountant reconciliation and QBO sandbox mapping | `/owner` → Invoices & money → Taxes and Settings; preserve supported scope and disabled QBO status. |
| WEB-09 | Connected route/weather/readiness acceptance; supervised assistant failure/staleness scenarios | Day routes and prepared visit workflow; no paid model activation or consequential AI authority. |
| WEB-11 | Named independent human security review and disposition of existing findings | Exact candidate, permission/financial/private-file tests and existing incident/security runbooks. No AI signature substituted. |
| WEB-12 | Choose custodian, restricted off-provider destination, retention/key custody and approve RPO/RTO; authorized actual backup restore | Existing capture-recovery and encrypted recovery runbooks are ready; synthetic restore is separate evidence. |
| WEB-13 | Actual failure/recovery alert receipt, operator handover, rollback rehearsal and commercial hosting eligibility | Existing watchdog, health endpoint and rollback/runbooks. No purchase or new recipient assumed. |
| WEB-15 | Real Google Business Profile/Search Console account ownership and URL inspection | Existing canonical .com sitemap/metadata; sign in directly to provider accounts, never send credentials in chat. |
| WEB-16–17 | Owner's finite acceptance outcomes, accepted defects, exact candidate CI/deployment/migrations/configuration and release decision | A01–A14 plus completion:gate; no completion percentage. |
| IOS-01–08 | Upstream native advisory resolution, signed Apple/device/native auth/share/privacy/push and independent/TestFlight/distribution evidence | Native register and apps/mobile/AGENTS.md; no fees/distribution authorized by this web change. |
| SCALE-01–03 | Complete second-company isolation/onboarding, actual legal/support decisions, load/recovery/offboarding and separate sale decision | Existing scale issues #39; no dropped scope or fabricated commercial approval. |

## Production read-only observations

YNSG database `jvigtwjlkmeyavzbxjzl` is active/healthy. Both named cron jobs (`ynsg-mail-worker`, `ynsg-calendar-worker`) are active on `* * * * *`. At 2026-10-21T19:48Z, each had a successful HTTP result within that minute and zero non-success HTTP results in the preceding hour. The latest applied migration names include `submitted_scheduling_review` and `decline_unconfirmed_quote`. This change adds no database migration or provider configuration. Production requests, invoices, payments and messages were not mutated for testing.

## Reproducible checks

- `npm run verify:release`: full contracts, types, application tests, blank-schema migration/lifecycle assertions and production dependency audit.
- `node scripts/build.mjs` and `pnpm --dir apps/web exec next build`: public/CRM optimized builds.
- `node scripts/verify-workspace-navigation.mjs`: full real-browser shell navigation, company/role changes, both themes/six widths and 200% text. Required in release CI; local browser archive downloads failed and no local real-browser result is claimed.
- `node scripts/verify-postgres.mjs` in required isolated PostgreSQL CI: canonical races/replay and recovery. Local PGlite success does not replace this.
- `node scripts/check-production-inventory.mjs`: all retained source references resolve; R01–R21 and all 28 gates remain.

This is a reviewable engineering update. It does not close the remaining external acceptance gates or represent full product completion. Exact remote CI and deployment outcomes belong in the PR after execution.

## Local candidate validation result

Full release checks passed with 895 application tests, zero failures, generated contract consistency, root/CRM types, blank-schema canonical PostgreSQL assertions (PGlite) and no known production dependency vulnerabilities. Public 11-page build and optimized CRM build passed. Full-shell synthetic tests include seven session/company/role/stale-response cases, plus four route/history behavior cases; the complete gate-report regression retains every gate and dependency. The production read-only public request, owner sign-in and worker/mail health smoke passed.

Actual Chromium/WebKit layout and native PostgreSQL multi-connection evidence remain required from exact-head CI. Neither has been replaced by the local DOM or PGlite checks. The production completion command remains blocked for the current candidate; no gate was falsely marked verified.

## Visual review follow-through

An isolated temporary Chromium runner enabled real local browser checks after the default browser download failure. The exact full-shell script passed 39 Chromium layout/navigation checks; the existing mobile workflow script passed 150 Chromium drawer/interaction checks with zero production writes. Rendered 200% invoice text exposed an overly narrow identity column despite no horizontal overflow; this was corrected with a stacked identity/balance grid, a bounded outstanding-balance label, and a minimum readable identity-width assertion. UTF-8 is explicit in the synthetic browser documents. Single-page record lists no longer display unnecessary paging controls; invoice balances precede optional scheduled work and administrative tools. The current candidate still requires both-engine exact-head CI; this does not establish physical-device acceptance.

## Timer recovery scope checklist (continued owner authorization)

Before timer changes: reviewed current Jobs API, canonical job_action SQL, owner command receipt helper, session identity contract, shell fieldAction and original constraints. Pass/fail requirements: exact job/action/revision/status receipt correlation; persist the frozen actor/company/body/key before sending; unknown outcomes survive refresh; one explicit exact replay control even after the displayed job changes; double taps cannot create another key; malformed success stays unknown; failed storage prevents a new timer command; revoked/other identity cannot replay; no production timer/work invented; generated API contract and full isolated checks required. A timer recovery record never contains a token, customer contact details, work description or payment information.

## Timer follow-through and final local validation

The canonical Jobs endpoint now validates the exact job ID, next revision and working/paused state; false, empty, unrelated, old or extra-field receipts remain uncertain. APPROVAL_REQUIRED and TIME_RECORD_REQUIRED are explicit rejections. The generated owner API contract now describes this guarded request and response. No SQL command or permission changed.

Start/pause/resume now persists one normalized frozen actor/company/body/key in the original tab before sending. The explicit recovery control replays identical serialized bytes after refresh or a changed displayed job. Double taps and alternate timer commands cannot create a second attempt. Recovery never sends automatically on load. Earlier unknown results remain protected after permission denial; another identity cannot replay them. Failed storage prevents sending. Confirmed server success stays labeled saved when local cleanup fails. The original-tab recovery record contains no tokens, customer contacts, work description or money, and does not promise recovery after the browser destroys that tab’s session storage.

Final local validation after this addition: 903 application tests passed with zero failures; full release checks, generated contracts, root/CRM types, PGlite migration/canonical lifecycle assertions and clean browser dependency audit passed. Optimized public/CRM builds passed. Real Chromium passed 41 full-shell checks, including timer reload/double-click/alternate-action/200%-text recovery; the prior 150 existing mobile interaction checks remain applicable. Exact-head native PostgreSQL and both-browser CI are required again for this amended single implementation commit. The previous navigation-only candidate passed both CI jobs at run 39666702197; that result is not substituted for the timer candidate.

## Release evidence commit constraint

The clean-tree certifier previously passed its own HEAD to every gate. Recording that SHA inside an evidence register would change HEAD, making clean committed completion evidence self-referential. The certifier now accepts an explicit `--candidate <full-SHA>` for the tested application source. It independently verifies actual Git ancestry and the complete change set: only contracts/production-completion.json and contracts/native-release-evidence.json may differ between the tested candidate and the clean evidence-recording commit. Any application, script, documentation or other file change requires a freshly tested candidate; caller-supplied proof is ignored. Candidate tree, evidence commit and changed register paths are retained in the report. Every original build/audit/evidence check and exact candidate evidence requirement remains. No existing gate is marked passed by this correction.

After actual acceptance exists, operators may run `npm run certify:production -- --candidate <tested-application-SHA> --output <private-report-path>` from the clean evidence-recording commit. Without --candidate, the existing current-HEAD behavior remains. Tests include actual temporary Git commits proving permitted register-only evidence and rejection of source changes, nonancestor history, malformed/forged proofs and incomplete comparisons.

Combined local release check after the certification correction: 906 application tests pass, zero failures. The timer/navigation candidate passed both required CI jobs in run 39668214409; this is retained historical evidence, and the final combined head requires its own complete CI. No human, provider, funds, backup or business acceptance has been invented.

## Public brand cascade correction

Rendered built pages exposed a real mobile regression: booking.css loaded after premium.css and its equally specific legacy header selector reduced the official logo to clamp(80px,22vw,96px), overriding the approved centered masthead. The obsolete width override is removed. At 390px the intact official image now renders 270px wide instead of about 86px, above navigation and the hero; its artwork and tagline are unchanged. The booking page uses the same corrected header. The new built-page browser check asserts a loaded full document, required booking form, at least 200px mobile / 300px desktop logo width, logo/navigation/hero order, no horizontal overflow, and zero page-load writes. It passes 16 local Chromium cases over homepage/request, four widths and light/dark; Chromium and WebKit are both required in release CI. No real hold, request or external provider call is used.

## Evidence acceptance transition checks

Pre-change constraint: gate tests must preserve fail-closed acceptance while allowing legitimate reviewed evidence to move the real registers to verified. Gate-status assertions now use explicit synthetic open, blocked and fully verified registers instead of assuming the production registers remain pending forever. The tests prove all 17 web, 8 native and 3 scale gates can accept valid candidate evidence, including native HTTPS evidence, and still reject missing proof or mismatched candidates. Actual production gate statuses and evidence are unchanged.
