# Service workflow repair — 13 October 2026

This release repairs the customer and owner workflow. Stripe setup, purchases and live charges are outside the current scope. The original branding, service exclusions, $60 standard / $45 Community rates and two-hour minimum remain in place.

## Acceptance checklist

| Requirement | Implementation and evidence | Remaining verification |
| --- | --- | --- |
| Easy appointment selection | Next available dates and times appear together; full month is optional; selection shows its actual expiry in Central Time. Existing conflict, hold and uncertain-submission protections remain. | Fresh saved website request and actual owner confirmation. |
| Owner understands the next step | A request opens its complete service workflow: appointment, agreement, actual work, invoice and received payment. Each step uses saved records; a later financial record does not invent an earlier appointment. | Owner walkthrough on a disposable, explicitly approved live request. |
| Owner can cancel a visit | Revision-checked, owner-only cancellation retains the request and financial history, releases reservations, revokes earlier links and stops superseded reminders. One cancellation message is queued. Started/completed work blocks cancellation. | Fresh live cancellation and recipient inbox confirmation. |
| Invoice drafting works after saving | Exact unchanged reviewed charges survive the owner's saved-revision refresh. Changed charges require review. Issuance waits for confirmed readiness and the new revision. | Real reviewed tax rules and one live disposable invoice. |
| Cash/Zelle receipts cannot silently duplicate | Received-money confirmation, balance checks and company-local time. An uncertain response locks edits; checking the saved result replays the identical command key and body. | Owner walkthrough and actual receipt reconciliation. No funds moved in this release. |
| Email status is honest | Invoice email/PDF is available in the workflow. Queued, provider-accepted and uncertain outcomes have distinct wording. Repeated requests create one logical message. | Fresh invoice, cancellation and reminder inbox receipts; provider acceptance alone is not inbox delivery. |
| Assistant guidance follows unfinished work | Active jobs, completed jobs missing invoices, saved estimates awaiting agreement and unpaid balances are covered. Stale/invalid evidence requires refresh. Human approval remains mandatory. | Observe guidance with a disposable live lifecycle. These are record-based rules, not a newly connected autonomous AI model. |
| Accessible controls | Large controls and readable text; semantic native forms, labels, visible next steps and keyboard focus. Calendar remains optional, with phone and arrange-a-time alternatives. | Real iPhone/Android, screen-reader and elderly/disabled-user testing; no accessibility certification claimed. |
| Release gates | Both website and CRM builds run syntax, root/app types, application tests, PostgreSQL migration/fixture tests and the production dependency scan. | Actual production build and custom-domain checks recorded separately. |

## Verified locally

- 275 application tests passed, including interactive React tests for invoice save → issue and an ambiguous partial payment response.
- Empty-schema migrations and PostgreSQL assertions passed. The continuous lifecycle uses canonical commands for website submission → owner approval → quote agreement → start/pause/resume → work record → completion → invoice → $50 cash + $70 Zelle. Retries leave one invoice, two receipts, a zero balance and a balanced journal.
- Cancellation tests cover wrong tenant, stale revision, changed retry, capacity release, retained request, stopped reminders, one logical notice, anonymous denial and simulated dispatch.
- Full website and Next.js production builds passed; production dependency scan found no known vulnerabilities.
- These local fixtures roll back and send no external email. They do not substitute for live browser, provider, backup or concurrency evidence.

## Still required before an unrestricted go-live claim

1. **Tax review:** the hosted business's saved tax treatment is unreviewed. The owner must configure reviewed tax rules and review the applicable customer-approved total. This release does not fabricate fiscal approval.
2. **Approved disposable live lifecycle:** submission, owner confirmation, reschedule/cancel, invoice/PDF delivery, recorded test receipts, and inbox checks. Earlier automatic approval review blocked a durable request/email test; no alternate submission path was used.
3. **Independent operations:** prove off-site restore, independent failure alerts, worker outage recovery and multi-connection booking races. Historic successful workers do not prove recovery.
4. **Actual device/accessibility review:** mobile keyboard, zoom, focus recovery and VoiceOver/TalkBack on physical devices; fresh customer account/recovery flow.
5. **Local search accounts:** verify Google Business Profile ownership and Search Console/sitemap submission. SEO metadata is not a ranking or indexing guarantee.
6. **Repeat visits:** weekly preference and first appointment are supported; the recurring preview does not reserve a 12-month series. Automated recurring reservations remain unfinished.
7. **Account security and hosting:** leaked-password protection is disabled; confirm the applicable Supabase plan/settings and enable it. Confirm Vercel commercial hosting eligibility. Existing advisor findings for guarded owner RPCs, private default-deny sign-in logs and provider-owned `pg_net` remain documented in the prior audit.
8. **Deferred scope:** Stripe settlement, native iOS packaging and complete franchise operations are not certified by this repair.

The earlier launch audit remains historical evidence. This release updates the non-Stripe service workflow; it does not declare every launch gate passed.

React interaction tests run in an isolated test-mode subprocess, including when Vercel inherits production mode. The Next.js application still compiles and runs in production mode.
