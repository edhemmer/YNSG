# Private attachment pagination

Gate WEB-06/11; issue #34. The owner customer attachment list and related job/invoice views now use a bounded 50-file page. The old complete-list RPC remains available to older deployments but is no longer used by these production screens. No files, links or original evidence are deleted or rewritten.

Scope checklist:
- Customer lists remain usable beyond the former 250-file ceiling. The descending creation-time/UUID cursor retains database timestamp precision and handles equal timestamps deterministically; the supporting index matches tenant/customer/status/order.
- Work/invoice filters operate in the database against the latest append-only link, before page limits. Targets must belong to this customer and tenant; corrections remove files from a former target's current list while retaining history.
- Current live owner/admin permission is required on every RPC page. Public wrappers are invoker functions; guarded definer code is private with empty search_path and restricted execution. No new table grants or public object URLs.
- Strict request/response contracts bind tenant, customer, target filters and cursor. Duplicate IDs, inconsistent next cursors, unbounded pages and unrelated links fail closed. Generated API documentation includes the page endpoint.
- Page read failures retain the last visible page while disabling sharing and writes. Retry repeats the failed cursor; late unmounted responses cannot affect a new customer. Page departure respects unsaved link drafts; unknown link/upload saves retain their exact original recovery path. Successful uploads reset to the newest page.
- Connected UI review uses the existing brand, real button controls, labeled page navigation, loading/error/empty states and bounded rendering. Isolated tests cover navigation, retries, unsaved entries, customer switches and server-filtered related files.
- Rejected: practice expansion, new paid services, invented consent/retention periods, customer QA uploads/records, destructive migrations, blind save retries or bypass of private owner-page approval review.

Validation includes an isolated 261-ready-file SQL traversal with equal microsecond timestamps (every file exactly once), canonical latest-link filters and cross-customer/expired-session denial. Full release, exact-head native PostgreSQL, production migration/privilege verification and both deployed SHAs are required for rollout. PR evidence records actual execution results; this document is not full WEB gate acceptance.

Remaining separate work: retention/deletion policy and execution, actual capture/consent/device acceptance and isolated object-byte backup/restore. Actual private owner-screen acceptance cannot be inferred from HTTP health or fixture tests. The CLI created the migration file; automatic approval review rejected its subsequent unsolicited PostHog telemetry request. No telemetry workaround or private-page bypass is part of this release.
