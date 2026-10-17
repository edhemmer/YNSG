# Customer, owner and operations acceptance runbook

Use the [charter](README.md) and [execution protocol](execution.md). Record case ID, candidate SHA, environment, tester/device, observed result, evidence reference and pass/fail. A failure gets a linked defect and affected gate; a proposed fix or screenshot alone is not a pass. No full-gate approval based solely on synthetic fixtures.

## Owner verification progress — October 17, 2026

The owner reports that the first three items on the verification list have been checked and that CRM routing and scheduling issues were discovered. **Checked means exercised, not accepted or passed.** Record the actual device, outcome, defect and evidence for each before closing the corresponding gate.

| Case | Owner progress | Acceptance | Follow-up |
| --- | --- | --- | --- |
| A01 — Public site/service navigation | Checked by owner (reported) | Not formally accepted | Capture device/result evidence; owner reports public pages look good enough for launch, with future visual polish deferred |
| A02 — Availability/calendar/appointment selection | Checked by owner (reported) | Open — scheduling issues reported | Reconcile offered times against final route checks, buffers, actual customer address and adjacent visits |
| A03 — Hold/race/retry resilience | Checked by owner (reported) | Not verified as passed | Obtain isolated race, expiry, disconnected submission and duplicate-submit evidence; do not treat owner check as proof all edge cases passed |

**Known CRM follow-up:** The owner reported an unexplained travel-time conflict on a proposed October 19 appointment. Routing fixes and repository checks do not establish that the live appointment was correctly evaluated. Verify actual neighboring appointments, operator, departure times, addresses, routing-provider response, buffers and final approval behavior without modifying live bookings for testing.

## Setup and evidence safety

Engineering first prepares an isolated compatible environment and synthetic records; it must not silently connect staging workers to production mail/APNs/Calendar. A Vercel preview pointing at production is not an isolated staging database. Only approved recipients receive controlled messages. Actual agreed service, tax approval, work completion and funds are owner actions on real facts; never create these in production to satisfy a test. Production evidence remains private/sanitized. Existing authorized earlier test evidence may be reviewed for current applicability rather than repeated without cause.

## Finite acceptance cases

| Case / gates | Action | Required outcome |
| --- | --- | --- |
| A01 / WEB-02,10 | On phone, open the public site and select several services, including one needing supplied water. | Navigation visible without guessing an expand icon, readable scope/rates, restrained controls, clear primary request action. |
| A02 / WEB-02,03 | View next times and month calendar; select a slot; also test “arrange a time.” | Only deliberate slot selection creates temporary capacity. Arrange-time clearly means no reserved appointment. Required contact/address entry, no account barrier. |
| A03 / WEB-02,03 | In isolation, race the last slot, expire a hold, disconnect during submit, double tap and retry the same attempt. | One winner/request; honest conflict; exact replay; preserved entries; no duplicate notification or abandoned durable reservation. |
| A04 / WEB-03,04 | Owner opens new request on phone/iPad, reads services, date/arrival/window and full note, approves or proposes another time. | One clear next action; review cannot manufacture agreement; availability rechecked; reschedule retains original until replacement succeeds. |
| A05 / WEB-03,07 | Controlled decline/cancel/reschedule, a recurring series and one changed occurrence, including DST and Google failure. | Exact capacity released/replaced, correct local times/travel, old reminder stopped, one appropriate series notice, valid current customer links and no stale reminder. |
| A06 / WEB-04,05 | Record actual agreed work, pause/resume/complete; in isolation also try interrupted completion, zero-charge and unauthorized changes. | Work saved once, timer stops, charges traceable, no automatic issue/payment; pending invoice preview separate from issued invoice; correct guarded next step. |
| A07 / WEB-05,08 | Review applicable tax and actual recipient; issue invoice; download/print PDF; deliberately request delivery. | Correct logo, invoice number, scope, dates, cents/tax/terms and recipient; immutable issued snapshot; readable document; accepted send and actual inbox receipt separately recorded. |
| A08 / WEB-05,07 | Enter only an actual received cash/Zelle amount; split only if actually received. Exercise lost responses/refresh/archive edits in isolation. | Total/Received/Remaining exact; one receipt/journal result; drafts retained; explicit discard; same attempt recovery; thank-you milestone does not repeat or imply unreceived funds. |
| A09 / WEB-06,07 | Customer signup/history, own invoice/quote, returning request, password/link expiry and recovery. Try another customer's link and revoked membership in isolation. | Optional account; valid current destination; no data/permission from matching email alone; clear denied/expired action; successful approved inbox delivery. |
| A10 / WEB-01,06 | Edit current contacts/properties/settings/notes, delegates and supported files; export/delete according to lawful retention. | Current vs original snapshot unmistakable; authorized private access; booked-address guard; no history erasure; all advertised editing works; missing promises tracked and finished. |
| A11 / WEB-08,09 | Review expenses/mileage/reports/CSV, daily route/readiness and assistant with missing data/provider. | Reconciled entries, current source-backed supported tax scope, no invented personal income; no AI consequential action; clear actual integration status and deterministic fallback. |
| A12 / WEB-10 | Test keyboard/screen reader, large text/zoom, dark/light, reduced motion, rotation and weak network. | No lost action or draft, clipped amount, inaccessible error, focus trap or hidden-only menu. Measure tasks below; record elderly/disabled participant feedback and fix failures. |
| A13 / WEB-11–13 | Independent security review, restore encrypted DB/files, controlled alert failure/recovery and safe rollback. | Human-reviewed boundaries, actual retained backup restored in isolation, approved recovery target met, operator receives failure/recovery, no duplicate mail/data loss. |
| A14 / WEB-14–17 | Review actual settings, local search ownership, accepted defects, release candidate and handover. | Dated Ed decision; real tax/hosting/operator inputs; all web gates accepted for candidate; both domain SHAs and migration/configuration checks documented. |

## Measurable experience targets

These are acceptance targets, not current measured achievements. Use a normal mobile network/device profile recorded with each result. Measure three successful runs after one orientation, retain each result and the median; do not exclude failed/abandoned attempts from findings. An elderly/disabled participant's inability to complete a critical task is a defect even if another tester is fast.

| Measurement | Target / method |
| --- | --- |
| Guest request | Median ≤2 minutes from request entry to saved confirmation, excluding deliberate reading/decision pauses recorded separately. No unresolved required field is hidden. |
| Returning signed-in request | Median ≤1 minute with saved details reviewed, not silently assumed correct. |
| Owner request review | Median 30–60 seconds to understand services/time and reach the appropriate reviewed action; customer consent waiting is separate. |
| Owner daily workflow | Open/read/confirm/complete/issue/close is one guided record with a clear primary action at each stage. No arbitrary click quota that hides required agreement/tax/funds decisions. Record taps/backtracking and remove duplicate entry. |
| Accessibility | Body ≥16 CSS px, adequate contrast, visible focus, labeled errors and controls with ≥44px usable hit area; restrained visual dimensions. Actual iPhone/iPad VoiceOver/large text, Android TalkBack, keyboard, 200% zoom/reflow, reduced motion. This is project acceptance, not legal certification. |
| Page performance | LCP <2.5s on recorded mobile test profile; 3-run results retained. Diagnose slow/error states; do not infer performance from an empty database. |
| API performance | p95 reads <750ms, commands <1500ms excluding provider time, 10 concurrent operators/10k isolated synthetic records; record dataset, environment and raw summary. |
| Automation | Enabled notification queue age <2 minutes and Calendar reconciliation <5 minutes under accepted operating profile; notification provider acceptance versus actual receipt separately measured. Never enable paid/provider delivery to obtain a metric without authorization. |
| Recovery | Proposed RPO 24h / RTO 4h remain proposals until Ed/operator accepts them and a timed actual authorized backup restore proves them. |

## Native acceptance extension

IOS-01–08 map one-to-one to the existing eight gates in `contracts/native-release-evidence.json`. Verify secure email/Google handoff, authenticated PDF sharing, opt-in new-request/next-appointment phone alerts, denied notifications, quiet hours, invalid tokens, logout and generic lock-screen content. Test signed iPhone/iPad builds with largest text, VoiceOver, dark/light, keyboard/rotation, interrupted app and offline recovery. Retain actual independent human review, audit resolution, Apple account/signing, privacy/account deletion and TestFlight results. App Review/distribution decision must be actual; a successful checker/build is not approval. Check current official Apple/Expo guidance at implementation/release; this document does not freeze changing provider rules.
