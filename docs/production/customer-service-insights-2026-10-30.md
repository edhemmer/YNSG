# Leaf management and customer service insights — October 30, 2026

Owner requested upgrades only where they improve the experience, general leaf-management wording, and retained customer/service frequency for future analysis and campaigns.

## Result and data contract

Public cards, service pages, cross-links and metadata say Leaf management. The existing leaf URL remains stable. Copy invites the customer to describe preferences and leaves the method for review, without promising bagging, curb placement or removal. The request builder shows its selected-job summary before task groups so a growing selection is easier to review.

The owner-only customer-service-history endpoint summarizes retained service_requests by current explicit customer_id. Customer records show total requests, service-category counts, job details, first/latest dates and generated recurring visits. Marketing gains name/service search and exact customer navigation. Each category and task is counted once per original request; declined/canceled requests remain part of demand history. Automatically generated recurring visits are reported separately. Historical leaf names normalize for reporting only; original submissions remain unchanged.

Guest requests are already retained with submitted choices, contacts and timestamps. Unlinked requests remain visible in company totals and require the existing deliberate customer selection during owner review before they enter an individual customer total. Shared emails never establish identity. The report does not infer campaign permission or activate email campaigns. Existing export/reauthentication, account permissions and provider controls remain authoritative.

GET /api/customer-service-history accepts organization UUID, optional customer UUID, query <=100 characters and page 0..10000. Response has at most 20 customers; each has at most 200 categories/task combinations, an explicit truncation flag and verified counts/timestamps. Query comes from one organization-scoped database snapshot, not a twenty-request screen page or a second mutable counter. The public RPC is SECURITY INVOKER; its private implementation has a locked search path and current owner/admin/session authorization. Anonymous and service-role execution are revoked. The additive index supports customer history reads. No business rows are rewritten.

## Verification and release

PGlite empty-schema migration and full database assertions pass, including 26 customer requests beyond screen pagination, legacy names/duplicate tasks, distinct category counts, generated visits, cancellation, unlinked guests, tenant/customer boundaries and retained originals. API/UI tests cover bounded/invalid inputs, denied/missing/outage/malformed results, safe read retry, exact customer navigation, and company-change/late-response isolation. Existing customer editor and booking tests pass. Chromium checks pass across 320/390/768/1366px, light/dark and 200% text; screenshots inspected; zero writes. Required final Linux/PostgreSQL, Chromium/WebKit and existing field/native gates remain required before release.

Migration: supabase/migrations/20261030090000_customer_service_history.sql. Apply the tested additive migration before application publication; verify database history, function signatures and grants, advisor delta, both production SHAs and read-only UI/health. Previous deployment remains a rollback target; the additive read function/index may remain if the app rolls back. Actual customer/device/provider acceptance gates remain open.

Supabase project structure was inspected through catalog metadata only before migration. Existing security advisories were recorded as baseline; no unrelated permission or paid authentication changes were made. Current changelog and database-function guidance were checked. React review: no new libraries, read effects abort/time out, results are scope-tagged, errors/empty/loading are distinct, and controls use labeled native elements.

## Applied database verification

Native PostgreSQL lifecycle/recovery passed in run 41065109320 before application publication. Applied migration history: 20261030134345 / customer_service_history. Live catalog confirms the index, public invoker/private guarded function, authenticated execution, anonymous/service-role denial and no-session denial. Security-advisor names/counts match the recorded pre-migration baseline; no new advisory. No production business rows were read into fixtures or rewritten. The migration map now has 85 repository mappings plus seven historical Supabase-only entries. Application/browser acceptance still belongs to the final candidate CI and deployment.
