# YNSG production release evidence ledger — 2026-10-15

Candidate branch `codex/crm-workflow`; merged SHA `a9b288b8d63e748fcfc0505203c95f67df5b9d19`; combined branch CI passed. Both Vercel production-tagged projects still report READY at older SHA `861c550ce7356f13c1927a4a2a98737b561146df`. This mismatch blocks final release.

All gates below remain unaccepted pending their required evidence. Do not fabricate customer records, provider mail, payments, backups, device tests or human security approvals.

| Gate | Status | Responsible role | Exact next step | Required evidence |
|---|---|---|---|---|
| WEB-01 | working | Engineering lead | Finish field-level inventory review under #31; #32 advances notes, expense, tax and calendar-block recovery; continue repeat requests and settings. | Feature inventory with source paths, issue links and requirement mapping. |
| WEB-02 | open | Engineering lead | Walk public navigation, services, pricing, contact and Services → Time → Details with deliberate selection and optional account. | Synthetic full-journey tests plus approved controlled delivery and physical-device evidence. |
| WEB-03 | working | Engineering lead | Accept calendar block create/edit/removal and exact-attempt recovery under #32; continue connected recurring/travel/cancellation/provider acceptance under this gate. | Native PostgreSQL races/replay tests, isolated provider tests and controlled connected-calendar acceptance. |
| WEB-04 | open | Engineering lead | Accept the complete phone workflow: open/read → confirm → complete → issue invoice → close out, including declined and zero-charge work. | Full scenario record linking UI, API, canonical revisions and isolated database assertions. |
| WEB-05 | open | Engineering lead | Finish invoice review, numbering, snapshot, recipient, PDF, email request, cash/Zelle split receipts and supported correction/archiving paths. | PR #28 plus current lifecycle/PDF tests and separately recorded recipient/inbox/funds acceptance. |
| WEB-06 | open | Engineering lead | Complete contact/property/history editing, current-vs-snapshot clarity, account claim/recovery, family/delegate authorization and retained records/deletion. | Two-tenant/customer tests, upload/deletion/retention cases and accepted owner/customer walkthrough. |
| WEB-07 | open | Engineering lead | Consolidate request, decision, reminder, invoice and paid-follow-up communication; review all email/link wording and ambiguity recovery. | Template/link tests, queue crash/retry tests, controlled independent inbox receipts and reminder timing. |
| WEB-08 | working | Engineering lead | Accept deployed expense and tax-entry recovery under #32; continue mileage, report/export reconciliation under #35 and actual owner/accountant tax inputs under WEB-14. | Reconciled fixture exports/calculations and dated owner/accountant review; QBO only advertised connected after sandbox proof. |
| WEB-09 | open | Engineering lead | Finish deterministic daily guidance, briefings, equipment/route readiness and supervised assistant behavior. | Scenario tests for incomplete records, stale data, prohibited commands, no provider and recovery. |
| WEB-10 | open | Engineering lead | Run design and usability acceptance from the protocol on desktop, phone and iPad; fix each observed failure. | Device/browser matrix, sanitized captures, task measurements and elderly/disabled participant findings. |
| WEB-11 | open | Independent security reviewer | Review auth, origin checks, tenant/customer revocation, private storage, financial commands, logs and dependency findings for the candidate. | Named independent human review, candidate SHA, findings/resolutions and scoped retest. |
| WEB-12 | open | Ed / operations operator | Choose backup custodian/destination/retention/key custody and approve recovery targets; engineer the scheduled encrypted DB-plus-file backup and failure alerts; restore authorized backup in isolation. | Restricted dated export/restore record, retention check, measured recovery and operator acceptance. |
| WEB-13 | open | Engineering lead | Prove alert delivery, unattended worker failure/recovery, runbooks, safe rollback and commercial hosting eligibility. | Received alert evidence, rollback rehearsal, plan confirmation and dated operational handover. |
| WEB-14 | open | Ed / business owner | Review actual company identity/contact, approved lawful services, pricing, schedule/territory, terms, invoice/tax inputs and privacy/retention. | Private owner decisions with settings/version IDs and tax/accountant review where needed. |
| WEB-15 | open | Ed / business owner | Verify real Google Business Profile and Search Console ownership, service area, contact/hours and sitemap/canonical indexing. | Account verification and inspection results plus current metadata/schema/sitemap checks. |
| WEB-16 | open | Ed / business owner | Execute the supervised acceptance runbook using authorized test recipients and an actual agreed service only for work/funds evidence. | Dated acceptance outcomes, sanitized references and explicit owner decision; failed steps become linked defects. |
| WEB-17 | open | Engineering lead | Prepare exact release candidate, all required CI, migration catalog, both domain SHAs, configuration/provider checks and release decision. | Exact-head CI, tested merge/deployed SHA mapping, migration checks and signed candidate decision. |
| IOS-01 | open | Independent security reviewer | Close native independent human security review gate. | Native register: human-security-review. |
| IOS-02 | open | Engineering lead | Resolve native audit findings with supported SDK/dependencies. | Native register: native-security-audit. |
| IOS-03 | open | Ed / Apple account owner | Confirm Apple enrollment/bundle/signing and build a signed candidate. | Native register: apple-signing. |
| IOS-04 | open | Engineering lead | Verify optional new-request and next-appointment alerts on a physical signed device. | Native register: push-delivery. |
| IOS-05 | open | Engineering lead | Implement and accept secure native authentication handoff and authenticated PDF sharing. | Native register: native-auth-and-sharing. |
| IOS-06 | open | Ed / acceptance participants | Accept full entry/edit/workflow on iPhone/iPad, dark mode, largest text and VoiceOver. | Native register: accessibility-and-entry. |
| IOS-07 | open | Ed / Apple account owner | Complete privacy/manifests/assets/account deletion/retention and current Apple review requirements. | Native register: apple-privacy-and-account-deletion. |
| IOS-08 | open | Ed / Apple account owner | Run TestFlight acceptance and retain actual distribution/App Review decision. | Native register: testflight-acceptance plus actual App Review/distribution decision. |
| SCALE-01 | open | Engineering lead | Accept second-company onboarding, branding/catalog/domain/sender isolation and platform subscription-only administration. | Isolated two-company end-to-end results and onboarding/operator runbook. |
| SCALE-02 | open | Ed / business and legal advisers | Resolve actual franchise/SaaS terms, support, disclosures, territory and cost/capacity ownership before selling. | Approved real business/legal package and supported tenant cost/capacity model. |
| SCALE-03 | open | Engineering lead | Accept load, tenant recovery/export/offboarding and repeatable second-company release. | Load/recovery/security evidence and separate scale release decision. |

## Non-negotiable acceptance

A passing CI check proves tested code, not entire workflow acceptance. For each gate, retain candidate SHA, device/environment, dated actual observation, reviewer role, sanitized evidence references, failures, and follow-up retest. WEB-17 depends on all WEB gates. IOS-01–08 require Apple signing and physical TestFlight/device evidence. SCALE-01–03 need independent second-company proof and business/legal approvals.

## Immediate critical path

1. Resolve why Vercel production-tagged deployments do not match merged candidate; verify both project/branch settings before releasing.
2. Complete isolated customer request → calendar → owner approval → work → PDF invoice → delivery workflow, then authorized provider receipt tests.
3. Implement and prove private files, account/delegation/retention, mileage and corrections, backup restore, security review and owner signoff.
4. Finish iOS signed auth, push, accessibility and TestFlight evidence; prove tenant isolation and multi-company onboarding.

PRs #62–69 are engineering contributions but close no whole gate. No real financial or customer data was created to manufacture acceptance.