# Owner notes recovery acceptance — 15 October 2026

Scope: WEB-01 audit and WEB-06/WEB-04 owner request/customer conversation history. Baseline production 6e4ed95c28b27625f2c9b8050f0edf898ce8fa87. Read current governance, engineering specification, note SQL/API/UI and full active instructions before editing. Preserve all current owner/customer records, brand, pricing, service restrictions and previously rejected choices. No Stripe, paid provider, mandatory MFA, native distribution or production record mutations.

Pass/fail requirements:

- Inventory all R01–R21 promised features against current source; distinguish implementation from actual acceptance. Track missing/partial families with concrete issues and gate links, without claiming WEB-01 closed prematurely.
- Define bounded note command/read/saved response contracts before code; generate matching OpenAPI.
- Keep canonical append-only `add_relationship_note` and `read_relationship_notes`, current owner/admin authorization, actor-bound exact retry and tenant checks. No direct table mutations or history overwrite.
- Separate definitive input/access/business rejection from unknown transport/database/result failure. Unknown mutation is 503, not a false definite rejection.
- One serialized attempt/key survives uncertainty; synchronously prevent duplicate submits, freeze editing/navigation and explicitly check the same saved attempt. No alternate note until resolved.
- Keep unsaved text on failed save/read or definitive rejection. Hide/close/pagination/refresh must not discard text. In-flight/unknown save blocks navigation; ordinary unsaved exit requires explicit confirmation.
- Validate saved receipt. A known saved note remains saved even if subsequent history refresh fails. Clear only its confirmed draft and allow a read-only history retry, without resubmitting the note.
- Isolate identity changes and ignore old async responses/unmounts. Preserve chronological pagination and private-only notes, readable phone controls, error/status labels and existing light/dark styling.
- Test duplicate click, lost/malformed response, exact replay, rejected input/access, failed history refresh, dirty read refresh, unmount/identity switch and unknown navigation block. Extend isolated SQL replay/actor denial where needed.
- Review complete UI/API/contract/generated schema and inventory; run release checks, exact-head PostgreSQL CI, optimized build, tested-head merge, both deployed SHAs and live read-only checks. Do not manufacture real notes/customer data as QA evidence.

Product completion remains governed by the master register. This document covers the scoped engineering acceptance, not a whole-product completion claim.
