# Pending request location finder

WEB-10 / #162: a pending request's street and city were removed by the queue's local read schema. Street search therefore found visits and active work but missed unconfirmed requests. Preserve those optional fields, match location and saved request status, and show the location beside Review request. Older records without location remain usable.

Acceptance: a multiword street/city/status query finds the correct authorized pending request; opening it reaches the canonical job with Confirm appointment; duplicate suppression, company changes, permission denial and partial-list disclosure remain intact. Search performs no extra reads or writes. No provider, subscription, migration, authentication or business command change.

Verification: component interaction test exercises the actual parsed API response. Full workspace browser coverage searches pending requests at 320/375/390/430/768/1366px, both themes and 200% text, then opens the job without mutations. Existing queue lifecycle tests remain required. Run exact-head release/PostgreSQL/both-browser CI and verify production SHA and read-only health before release handoff. Physical device and owner acceptance remain open; this does not close the overall mobile UX gate.
