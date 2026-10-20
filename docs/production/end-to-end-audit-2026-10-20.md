# YNSG full journey audit — October 20, 2026

## Authority and scope

This is an **engineering review snapshot**, not a passing WEB gate or owner signoff. Use docs/governance.md, docs/production/README.md, execution.md, acceptance.md and contracts/production-completion.json as the controlling source. This single atomic commit changes navigation/payment clarity only. It cannot substitute for comprehensive customer-to-closeout acceptance.

| Journey | Verified code path | Remaining acceptance evidence / risk |
| --- | --- | --- |
| Public Services → Time → Details | Public intake and scheduling routes exist; WEB-02/03 | Execute A01–A03 with synthetic conflict, no-time, retry and controlled recipient evidence; live device signoff outstanding |
| Request submission and owner inbox | request-inbox.tsx; request-quick-actions.tsx; request-detail.tsx | A04/A05: confirm/decline, branded reviewed messaging, contact/note visibility, saved state, DST/recurring |
| Confirm/replan appointment | scheduling-review-panel.tsx; service-workflow.tsx | Recheck route buffers, reschedule race, idempotency, real calendar/provider behavior |
| Field route / work | owner-day.tsx; service-workflow.tsx; owner-work.tsx | A06: test one-tap deep links, jobs outside first data page, actual time/start/pause/complete and lost responses on phone |
| Scope and invoicing | invoice-draft.tsx; scheduled-invoice.tsx; invoice delivery | A06/A07: trace saved work, minimums, material cost and tax; pending invoice not issued; deliberate issue/send and PDF recipient checks |
| Cash and Zelle | invoice-payments.tsx; payment-input.ts; RecordPayment command | Both methods require manual actual-receipt confirmation. Zelle is **not** processor verified, not a bank-linked automatic payment. Test valid partials, overpayment rejection, duplicate/idempotency, unknown outcome and corrections under A08. Never infer receipt from screenshot. |
| Closeout and saved history | service-workflow.tsx; customer records; invoice payment summary | A08–A10: verify zero balance only after actual confirmed receipts/credits, record persistence, archive without erasure, returning customer access, corrections and privacy |
| Experience, accessibility and operations | WEB-10–17, A12–A14 | iPhone/iPad physical tests, all controls, focus/keyboard/overflow, real auth, backups, restore, monitoring, deployment SHA/aliases, human signoffs. **Open until evidenced.** |

## Functional product rule

The owner should encounter a concise action-first Today queue and one connected request/job path, with optional details behind disclosures. The system prepopulates available data but must not manufacture scheduling acceptance, extra work, invoice issuance, customer communication, tax decisions or funds. Each interaction must either navigate to its actual saved record, execute its canonical guarded command, or provide a visible explanation. No duplicate business entry. Keep required exceptions and audit records.

## Release decision

Do **not** declare full website or CRM complete from green CI or this audit document. Before a release claim: run gate and acceptance commands, trace each real UI→API→database→next-action path, record device/provider evidence and verify both production domains at intended merge SHA. Open finding #162 remains controlling; missing evidence is not a pass.
