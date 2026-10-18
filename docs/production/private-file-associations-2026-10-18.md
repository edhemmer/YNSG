# Production private-file organization

Scope: WEB-06/11; issues #34/#37. This advances file organization, not retention/account deletion or whole-gate acceptance. No practice-mode changes are part of this batch.

## Connected owner flow

Open the customer record from the service workflow, then Private photos and receipts. Uploads remain JPG/PNG, private and server-verified. Each saved file can be organized under the customer record, a job or invoice belonging to that same customer, or a deliberately reviewed company expense. Expense targets require the finance entitlement and a receipt-purpose file. Expenses have no pre-existing customer ownership; the UI explains that the owner must verify this association. Linking does not alter financial records or share a file with a customer.

Job and invoice work views expose an on-demand linked-file list plus the customer attachment entry point. Invoice views include their job attachments. Lookup is explicit, not background provider traffic. Target searches page through 50 records and label jobs with agreed scope, invoices with actual numbers and expenses with vendor/date/amount/reversed state. Link history retains descriptive labels, time and reasons even after a later correction. Customer-only is the explicit way to remove the current specific association while preserving all earlier events.

The canonical command requires current verified live owner/admin access, exact file/customer/company, a ready verified file, the current link version, explicit review, a reason and an actor-bound exact-attempt receipt. A file lock serializes competing changes. Append-only events and audit retain the original; table writes/deletes are denied and immutable. Job/invoice targets must belong to the file's customer. Expense targets must belong to the company. No bytes are replaced, no issued snapshot changes, no receipt money moves and no customer message is created. Current-version checks are not a new financial approval.

## Recovery and experience

- Unknown link saves freeze their entries and replay the identical serialized command/key, including after a subsequent access rejection. A mismatched success receipt remains unknown.
- A confirmed link followed by failed list refresh remains confirmed and exposes read-only refresh recovery. Other mutable attachment controls stay locked until that refresh succeeds.
- Unknown upload attempts retain the original file, purpose and key across a later rejected retry. Customer changes unmount the old file workspace; late upload/download results do not act on the newly selected customer.
- Read failures disable new uploads/file access until successful refresh. Permission rejection clears protected file metadata. Customer switches clear related-work lists synchronously through component identity.
- A verified file download opens a tab within the original click. If popups are blocked, the owner receives an explicit verified HTTPS download link that disappears before its 60-second lifetime ends. Failed verification closes the empty tab and exposes no unverified URL.

Bounds: complete customer lists retain the existing 250-file limit and fail visibly above it; no incomplete list is presented as complete. Each file supports at most 100 append-only association events; history is complete within that enforced bound. These operational bounds must not be represented as unlimited storage. Broader pagination/retention/offboarding remains separate work.

## Verification and rollout

Runtime contracts and generated OpenAPI cover private list/history/search and link commands. Isolated SQL covers exact replay, stale/changed retry, customer isolation, immutable history, original digest retention, receipt expense linking, explicit customer-only correction, live-session denial and restricted grants. Native PostgreSQL CI additionally races two connections against one link version and compares file metadata/history through a full isolated dump/restore, alongside financial/booking fixtures. UI/API tests cover uncertain result, access rejection, exact replay, confirmed-save/read-failure recovery, different-identity receipt, late response/customer switch and popup blocking.

Run full release checks, optimized CRM build and exact-head native PostgreSQL CI before applying the migration. Apply `20261018190517_private_file_associations.sql`, observe its actual hosted history version, verify grants/catalog metadata, update the migration history map and rerun exact-head CI before merging. Confirm both production SHAs/aliases and read-only health. No production QA upload, association, financial record, booking or message is authorized by these tests.

Retained business evidence is not erased. Customer account deletion, retention policy/execution, malware scanning/full image decoding, independent human security review and device/actual provider acceptance remain open.

## Recorded migration evidence

- Initial candidate release CI [39158044878](https://github.com/edhemmer/YNSG/actions/runs/39158044878) passed both required jobs, including concurrent file correction, exact replay and restored file metadata/history. Local full release checks passed 626 application tests, SQL lifecycle/security, types/contracts, browser dependency audit and 11 public pages; optimized CRM build passed.
- Hosted migration private_file_associations applied 18 October 2026 as actual history version 20261018191836. Read-only checks confirmed anonymous/service link execution denied, authenticated wrapper granted, RLS enabled, immutable history trigger present and live staff guard retained. No production QA association, upload, financial change or message was created.
- Post-migration security advisors retain the same categories/counts: two private mobile RLS/no-policy notices, public pg_net extension, twelve guarded authenticated definer RPCs and disabled leaked-password protection. No finding was suppressed. References: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Final follow-up includes the canonical invoice customer ID so the attachment entry point does not depend on whether its job is on the same records page. It also explicitly tests a same-company file trying to link another customer's actual job. The final head must pass full CI before merge; verify both production SHAs and read-only endpoints afterward.

## Error-state follow-up

A final surrounding-flow review found that denied/unavailable reads could appear beside a false empty-list message. Attachment and target-search screens now reserve empty-state copy for successful reads. The corresponding UI tests assert that failures show recovery and never claim missing records. A confirmed upload also clears its native file picker, keeping a deliberate repeat selection usable. This follow-up changes UI recovery only; it requires current full release/native CI and optimized build, with no new schema or production data changes.
