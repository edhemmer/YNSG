# Requirement traceability

Status vocabulary: planned / implemented / verified-local / verified-staging / deployed / release-blocked. Passing one test never certifies the whole row. MP = master prompt revision 4; BP = business plan; TP = technology plan. Evidence lives in docs/evidence/ and test output, never in fabricated counters.

| ID | Source | Decision / module | Implementation and acceptance | Status |
|---|---|---|---|---|
| R01 | MP1,2; BP3,12 | D01 preservation | site/, api/requests.js, scripts/build.mjs; compare baseline public hashes, build and endpoint regression | planned |
| R02 | MP1,16,18 | Governance and checkpoints | docs/*; requirement coverage and resumable build state | implemented |
| R03 | MP3,3.1,6,15 | Tenant identity, MFA, delegation, entitlements | supabase, packages/server; two-tenant/customer, revoked membership/session, assigned technician tests | planned |
| R04 | MP3.1 | Versioned configuration / onboarding | publish/rollback commands, contrast and asset ownership; historical identity snapshot and second-company tests | planned |
| R05 | MP7; TP4 | Guest durable intake | original payload, idempotency fingerprint, throttle, request+audit+outbox transaction; provider failure preserves request | planned |
| R06 | MP6 | CRM, property/contact/household and portal | authorized relationship links, import preview, export/deletion; no email-string auto-claim | planned |
| R07 | MP9; BP5,8 | Pricing/quotes/approvals | integer cents, exact quote version, scope compliance, policies; 120/90 and 180/135 fixtures; stale approvals rejected | planned |
| R08 | MP8,8.1; BP9 | Scheduling and travel | atomic reservation/holds, neighbor travel, pickup, DST, recurrence, overrun and override; concurrent capacity test | planned |
| R09 | MP8.2 | Required Calendar | OAuth, busy facts, event projections, controlled moves, ETags, token reset/repair; live test with private calendar | planned |
| R10 | MP9,10 | Jobs and invoice | time/change approval, CompleteAndInvoice transaction, frozen document and numbering; retry produces one invoice | planned |
| R11 | MP10,12 | Payments and ledger | confirmed manual payment, allocations/reversals, balanced journals; partial/unconfirmed/duplicate tests | planned |
| R12 | MP11 | Gmail / communication outbox | leases, attempts, unknown-send reconciliation, provider health; independent mailbox and crash tests | planned |
| R13 | MP11.1 | Receipt/thank-you/review | one payment milestone intent; no partial/writeoff/reversal/historical blast; configured URL only | planned |
| R14 | MP12 | Expenses/mileage/reports/taxes | transaction drilldown, cash/accrual exports, official versioned tax fixtures and missing inputs | planned |
| R15 | MP13 | Daily assistant | permission-scoped evidence queries, typed confirmed commands, deterministic fallback; injection/outage tests | planned |
| R16 | MP14 | Native iOS | Expo shared API, secure sessions, drafts/photo/push/deletion/deep links; real-device and TestFlight evidence | planned |
| R17 | MP5,14,17 | Accessibility/performance/usability | keyboard, VoiceOver, small/large phone, zoom, reduced motion, measured task times | planned |
| R18 | MP4,15 | Reliability/privacy/recovery | private Storage, safe logs, restore DB plus bytes, monitoring/rollback and cost register | planned |
| R19 | MP11.2 | Integration boundaries | configured/error/disabled UX, QBO sandbox mapping/export; optional adapters do not imply connection | planned |
| R20 | MP3.3,17.16 | Canonical determinism | docs/canonical-authority.md, deterministic-rules.md; repeat/replay/stale-version tests across command clients | planned |
| R21 | MP17,18 | Release evidence | CI, migrations empty/prior, actual previews, Git SHA, security scans, integrated flow and rollback | release-blocked |

Acceptance catalog: MP17 cases 1–16 map respectively to R05; R03/R06; R07; R07/R10; R08; R12; R11; R14; R16/R17; R18; R03/R04; R09; R13; R15; R08/R12/R16; R20. This table is a coverage index, not a claim that acceptance has passed.
