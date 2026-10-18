# Manual review — production b514b0c
Reviewed 18 October 2026 UTC. Candidate: `b514b0c363577ffa958e8c2123a24fc45ef2528e`.

## What is established
[Post-merge CI](https://github.com/edhemmer/YNSG/actions/runs/39083353687) succeeded for the released code, including browser/contracts and native PostgreSQL checks. The preceding engineering validation recorded 583 passing application tests, database lifecycle/security tests and optimized builds. Both Vercel production deployments were rechecked READY at this SHA with their intended custom domains. Fresh read-only checks returned HTTP 200 for request, owner entry and API health. These prove deployment availability, not an authenticated workflow or physical-device pass.

The browser walkthrough timed out; no visual/interactive pass is claimed. The transient checkout was unavailable after that timeout, so the earlier complete test results are release evidence, not a newly rerun suite. PR #115's evidence URL strings violate the register contract; this revision removes them from the gate evidence array and retains technical release references here. WEB-17 remains working, not accepted.

## Start with sample data

Open [owner practice](https://yourneighborhoodserviceguy.app/owner/practice) and follow the [sample review sequence](owner-practice.md). Six fictional visits let you test the actual workflow screens for items 4, 6, 7 (document layout), 8, 10 (supported editing/mileage) and 11 now. Changes stay in this tab and can be reset. You do not need real customers or money to rehearse these screens. Sample responses are simulated; sign-in, canonical server behavior, provider delivery, private files, actual tax settings and the real October 19 route require separate evidence. No gate is accepted merely by exercising samples.

## Your check list
Use your normal phone first, then iPad/desktop for items 1, 3, 4 and 11. Record Pass / Fail / Not exercised for each. Use only actual agreed service and received money for live commands. Do not create dummy bookings, invoices, consent, payments or messages in production. Engineer-owned isolated tests cover race/failure cases; you need not reproduce them against customers.

| # / cases | Check | Expected result |
| --- | --- | --- |
| 1 / A01 | Open [public site](https://www.yourneighborhoodserviceguy.com/). Visit Services, Pricing, About and footer pages. Try Call/Text without sending. | Visible navigation, clear primary request action, readable content, correct business/contact details, no horizontal scrolling or blocked buttons. Standard $60/hour, Community $45/hour, one combined two-hour minimum remain correct. |
| 2 / A01–02 | Open [request](https://www.yourneighborhoodserviceguy.com/request). Select several services, including pressure washing, add a note, move forward/back. | Services and note persist, water requirement appears where applicable, Services → Time → Details is clear; account remains optional. Stop before submit unless making a real request. |
| 3 / A02 | Review quick dates and month calendar, Central Time wording, weekly choice and arrange-time option. | Understand selected time versus temporary hold versus confirmed appointment. Arrange-time means no reservation. Selecting a live slot can create a temporary hold; do this only for an intended real request. |
| 4 / A04 | Open [owner workspace](https://yourneighborhoodserviceguy.app/owner), sign in normally and read an existing request. | Correct company and full services/note/address; date, arrival/window, status and next action understandable without hunting. Refresh/back does not select another record unexpectedly. |
| 5 / A02,04–05 | Review the reported October 19 travel conflict against real neighboring visits, addresses, operator and buffers. | Conflict explanation matches actual route and departure times. Record exact message and affected time privately; do not modify live bookings to test it. This report remains unresolved until reconciled. |
| 6 / A06 | At the next actual job, follow confirm → start/pause/resume → complete. | Consent and work remain deliberate, timer/state accurate after refresh, one clear next action; pending invoice is clearly a preview. Do not complete work early for testing. |
| 7 / A07 | Review a legitimate invoice preview and PDF. Issue/send only when actually appropriate. | Correct recipient, services, dates, number, logo, rate/minimum, amounts/tax/terms; readable on phone and print. Actual inbox receipt is checked separately from provider acceptance. |
| 8 / A08 | When actual cash/Zelle funds arrive, record the true amount once. | Total, Received and Remaining reconcile after refresh; receipt/thank-you correct. Use owner practice to rehearse correcting a mistaken cash/Zelle entry. Live correction requires a real mistaken entry and reason; it preserves the original and does not transfer money. Do not invent funds to exercise it. |
| 9 / A09 | Open [customer account](https://yourneighborhoodserviceguy.app/account). Review your authorized history, document links and returning request entry. | Clear sign-in/recovery, only authorized records, readable documents and reviewed saved details; no duplicate request after a successful save/refresh. |
| 10 / A10–11 | Review actual contacts/properties, notes, supported files, delegate controls, mileage and reports. Save only intended edits. | Current details distinguish original submission; a failed read offers recovery; switching records does not show/save another record's data. Totals match canonical entries. Do not add a delegate or upload/export customer data merely for QA. |
| 11 / A12 | Try large text/200% zoom, keyboard, VoiceOver if available, dark/light, rotation and normal weak reception. | No clipped amount, hidden primary action, lost draft, focus trap or unreadable error. Report screen/action and device; avoid private customer screenshots in public issues. |
| 12 / A14 | Review Settings and actual provider status; list business/operational decisions privately. | Correct identity, services, rates, territory, working hours, invoice/terms/tax settings; disconnected integrations say so. Record backup custodian, alert recipient, hosting eligibility and local-search ownership decisions. No paid activation needed for this review. |

For a failure, send: item number, device/browser, screen/action, expected result, actual result and approximate time. Keep customer identity, addresses, invoices and screenshots private. A check means exercised; it becomes accepted only after the outcome is recorded.

## Engineering and external work that this list does not close
- Actual October 19 routing explanation and subsequent affected scheduling acceptance (WEB-03).
- Invoice credits/actual refunds, cash/accrual reconciliation and QBO mapping remain open (#35; WEB-05/08). Receipt corrections and complete transaction journal export are implemented in the [security/finance batch](security-finance-2026-10-18.md); engineering tests do not substitute for owner/device acceptance.
- Full private-file associations and retention/account deletion remain open (#33/#34; WEB-06/11). Server-only byte verification is implemented in the security/finance batch; the earlier gap inventory is historical.
- Source-backed weather guidance and outage/staleness handling (#36; WEB-09).
- Physical-device accessibility/performance, controlled recipient delivery, independent human security review, actual encrypted backup restore, alert receipt/recovery and rollback (WEB-07,10–13).
- Native distribution remains blocked by unresolved dependency advisories and separate signing/device/privacy/TestFlight gates. Native builds do not prove distribution readiness.
- Multi-company sale retains separate isolation/onboarding/legal/support/load/offboarding gates.

The full governing [A01–A14 acceptance script](acceptance.md) and [engineering inventory](engineering-sweep-2026-10-18.md) remain in force. This packet prioritizes practical owner review without transferring engineer-controlled missing work to owner signoff. No whole-product completion or 98% claim is made.
