# Owner availability review — October 2, 2026

This continues the approved production CRM build. It is a tested scheduling component, not a completed scheduler or release certification.

## Requirement check

| Requirement | Result |
|---|---|
| Preserve public website/logo/copy and working email | No public-site files changed; CRM cutover stays disabled |
| Exact published Mon–Fri/hours/minimum/half-hour policy | Uses company configuration; no widened 24–36-hour window |
| All selected physical resources and owner blocks | Included in capacity screen with configured buffer |
| Current Google facts; no browser-provided busy booleans | Server obtains Google free/busy; partial errors fail closed; 60-second observation |
| Tenant isolation, verified owner/MFA and entitlement | Protected snapshot command; no anonymous or service-role execute |
| Timezone/DST and unusual UTC offsets | UTC-instant enumeration with local-time validation |
| No unrecorded appointment or claimed reservation | GET is read-only; panel says no time is reserved |
| Stale UI/request responses | Organization/resource changes invalidate pending responses; checks expire visibly |
| Full booking, guest links, approval and recurrence | Pending; existing canonical commands are not bypassed |
| Live Google, browser/mobile accessibility, concurrent PostgreSQL and recovery | Unverified; remain release gates |

Source: packages/domain/availability.ts, apps/web/app/api/availability/route.ts, apps/web/app/availability-panel.tsx, protected scheduling_snapshot migration and workspace integration.

Verification: 35 unit/contract/domain/adapter tests pass, including availability windows/buffers/resources/stale data/closed days/DST. Empty-schema migrations and foundation/commercial/scheduler/Google/owner/operations/availability SQL assertions pass locally in PGlite. Snapshot tests check tenant and customer denial, anonymous permission denial, expired holds and no appointment mutation. TypeScript/build results and hosted rollout are recorded after validation below. These do not prove genuine provider behavior or multi-connection races.

Migration adds only a protected read-only snapshot function and wrapper; no business records changed or notifications activated. Rollback is a forward migration revoking the snapshot command after removing its UI caller; preserve canonical appointments and reservations. Never erase operational history.

TypeScript and Next.js production build passed. Hosted scheduling_reviews migration applied to YNSG; migration history and authenticated-only snapshot execute permissions verified. Database still has zero organizations and appointments; no live owner/calendar flow was exercised. Vercel deployment follows the source commit; readiness is not assumed until checked.
