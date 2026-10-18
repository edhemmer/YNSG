# Historical addresses for scheduling and day routes

Gate WEB-03; issue #36. The public intake intentionally retains street/city only. Scheduling and daily-route estimation previously sent those ambiguous addresses directly to the route provider. They now resolve the exact immutable region recorded in each request's owner-notification configuration version, checking the original city against that version. Explicit original state remains authoritative. Current company settings, mutable property records and provider guesses are never substitutes; original submissions remain unchanged.

Scope checklist:
- Pass: same street/city in different historical states cannot become a false zero-drive stop.
- Pass: resolve all relevant neighboring addresses before provider calls; preserve overlap, pickup, configured-buffer and impossible-gap checks.
- Pass: org-scoped read-only batches of at most 100 IDs, exact count checks, complete records and duplicate/version/city validation. Shared configuration versions are read once per batch set; a 205-request fixture covers batching.
- Pass: day sheet and metadata freshness use the same resolved addresses. Missing historical evidence retains visits/packing while suppressing that address's directions and unsupported travel estimates. Failed/truncated reads remain errors.
- Rejected: guessed Illinois/current-state fallback, edits to submissions, synthetic production records, paid activation, automatic customer schedule changes, practice-workspace expansion, full-gate completion claims.

Validation: focused address, scheduling and day-API fixtures cover mixed states, missing/ambiguous/invalid history, bad explicit addresses, denied owner access, incomplete reads, batching, matching metadata fingerprint and no provider use for unresolved addresses. Full release checks, optimized CRM build and exact-head native PostgreSQL CI are required before production merge; deployment mapping belongs in the linked PR.

No migration or provider configuration changes. No real customer data copied into fixtures. The reported actual October 19 route has not been accepted by these isolated fixtures; actual provider/device/calendar recovery acceptance remains under #36/#37.
