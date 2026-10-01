# Scheduler upgrade — October 1, 2026

Additive source: YNSG_CRM_SCHEDULER_UPGRADE_PROMPT.md, sections 1–9. Continues master revision 4. No restart, new database, or public intake cutover. Supersedes prior override assumptions: a physical resource can never be double-booked, even by an owner. Appointment approval is separate from commercial approval.

## Requirements / implementation / verification checklist

Source SHA256: ab8df63b81b9d187fed9094e639b4ca9bd2426455ba7740f46b7f7af792c6d85.

October 1 evidence: migration applied to hosted YNSG only; synthetic scheduler SQL transaction passed and rolled back. Local empty-schema/foundation/commercial/scheduler checks pass. Security advisor returned no lints. Tests cover overlap rejection, independent resources, retry, stale revision, approval, retained-original replacement, expiry, retired unsafe entry point and ambiguous-send recovery. Deferred constraints reject removing an active operator reservation. Concurrent-session races and genuine provider round trips remain unverified.

| ID | Requirement | Responsible implementation / required evidence | Status |
|---|---|---|---|
| S01 | One engine, resource exclusion, atomic results | scheduling RPC, resource reservations, PostgreSQL concurrent overlap tests | in progress |
| S02 | Selection holds, submitted proposals, owner deadlines | appointments + reservation lifecycle; delayed-cleanup expiry tests | in progress |
| S03 | Approve, Decline Time, Decline Service | revision-checked commands + atomic audit/outbox; scanner GET cannot mutate | in progress |
| S04 | 48 elapsed-hour reminders, reconfirmation | revision-bound reminder intents; DST/late-send/under-48-hour tests | in progress |
| S05 | Retained original during replacement | linked alternative proposal; atomic swap/decline/expiry tests | in progress |
| S06 | Optional recurrence and rolling horizon | local calendar rules, individually addressable occurrences; monthly/DST/partial conflicts | planned |
| S07 | Customer selection calendar in existing form | accessible form-preserving picker + scoped guest commands; anonymous abuse/races | planned; disabled |
| S08 | Today agenda, service colors, load sheet | current confirmed order preparation; label contrast/readiness invalidation | planned |
| S09 | Gmail/Calendar reconciliation | tenant adapters, controlled external proposals, ambiguous-send recovery | planned; unconfigured |
| S10 | Reports, exports and company configuration | scoped printable/PDF/CSV as-of reports; second-tenant fixtures | planned |
| S11 | Portal dashboard, saved properties/repeat work | explicit relationships and fresh request/terms; access tests | planned |
| S12 | Optional private uploads | MIME/size/content inspection/metadata stripping; consent/deletion tests | planned |
| S13 | Family invitations/preferences/history | separate coordination/approval/billing grants, revocation and private notes | planned |
| S14 | Change approval, closeout, completion summary, concerns | accepted versions and duration recheck; invoice retry and no accidental concern billing | planned |
| S15 | Waitlist, weather, blocks and equipment | opt-in scoped offers, owner weather changes, exclusive resources; no silent moves | planned |
| S16 | Cancellation, no access, no-show, series pauses | scoped transitions/reminder invalidation, no invented fees | planned |
| S17 | Performance dashboard and three assistant views | canonical drilldowns, unknown-vs-zero, safe dictation and model-outage tests | planned |
| S18 | Full verification/recovery/deployment | hosted races, browser/native accessibility, database+files restore, CI and actual CRM deployment | release-blocked |

## Gaps found in previous implementation

The previous `reserve_appointment` locked an idempotency key rather than shared resource capacity; different keys could race. It did not enforce operating hours, travel freshness, owner approval or hold expiry. Its tests did not cover these database commands. The earlier claim of an atomic verified scheduler was too broad. The public static-site deployment also did not deploy apps/web. This upgrade corrects those claims and closes each gap with evidence.

## Exact additive data design

resources(org,id PK; kind operator/equipment/trailer; status available/out_of_service) owns physical capacity. resource_reservations(org,id PK; appointment FK; resource FK; [start,end) tstzrange; active; unique org/appointment/resource) uses a GiST exclusion constraint on org/resource/overlapping active interval. RLS denies all ordinary table writes. A tenant scheduling-state row serializes engine decisions; resources lock in UUID order. Reservation overlap integrity remains enforced even if a writer forgets that lock.

Existing appointments gain request FK, parent replacement FK, arrival time, expiry, creator and response/revision. Active states: selection/held, proposal, reserved, needs_review. Terminal states: expired, declined_time, declined_service, canceled, replaced. A replacement proposal holds another interval while original remains reserved; approval atomically retires original and promotes alternative. Overlapping alternatives for the same resource are rejected, not exempted from exclusion.

Trusted scheduling evidence binds organization, request, exact interval/arrival/resources, configuration version and scheduling revision to verified provider facts with expiry. Browser-supplied booleans cannot establish feasibility. No provider adapter currently produces that evidence: automatic scheduling stays disabled. Evidence must cover both neighboring travel legs, pickup/supplier readiness, owner blocks and Google busy data. Database independently rechecks hours, minimum/increments, duration, resource status and interval exclusion.

Appointment mutations commit audit and outbox together. Reminder keys include appointment ID and revision; due = arrival minus exactly 48 hours. Under-48-hour approval creates confirmation only. Delayed dispatch must revalidate current revision/state and start time. Moves suppress old pending intents; uncertain sending attempts require reconciliation. No GET mutation or public approval RPC.

## Consolidated activation additions

Owner must configure selection duration, proposal decision deadline, lead/horizon, pending limits, recurrence horizon/renewal, cancellation permissions, buffer/holidays and quiet-hours deferral (if any). No arbitrary default is activated. Google freshness/provider evidence and authenticated Gmail remain required. Guest scoped links, provider workers and native/report tests must pass before advertising customer booking.
