# Business snapshot and email verification — October 4, 2026

Acceptance checklist before implementation:
- [x] Owner/admin-only snapshot; current tenant permission checked on every request, with existing database row policies retained.
- [x] Exact database counts and established finance totals; never sum a paginated workspace page or invent missing values.
- [x] Period, timezone, update time and metric definitions visible; cash remaining is not described as profit or a tax estimate.
- [x] Readable mobile cards, labeled comparison bars, keyboard actions, accessible text values and no misleading pie slices for overlapping data.
- [x] Google mail displays the business name without replacing the verified sending address; safe header encoding retained.
- [x] Recipients remain from verified request/customer links or approved invoice snapshots; no arbitrary replacement of historical invoice recipients.
- [x] Appointment date/time comes from the saved appointment and revision checks prevent stale queued notices.
- [x] User-supplied Google review link belongs only to YNSG, not other SaaS owners; optional review settings remain configurable.
- [x] Email activation checked against live YNSG settings; do not infer activation from a calendar connection or a template build.
- [ ] Build, tests and deployed entry points checked; live owner/inbox tests explicitly distinguished.

Live check: YNSG organization a933d657-14d3-46b6-85e6-21d973e4ed97 is in setup with zero published settings, zero email approvals and Gmail test not_tested. No owner identity, receipt confirmation or approval was forged.

## Verification and remaining gaps
- Production build and 103 automated tests pass, including local business-date boundaries through daylight-saving changes, safe sender-name encoding and multi-service message contents.
- PostgreSQL migration and workflow assertions pass in PGlite, including replacement scheduling and stale-notification checks. Live provider delivery and concurrent connections remain separate acceptance tests.
- Snapshot queries use the signed-in owner token and existing row policies, with no service-role bypass or new database grants. Exact counts span all authorized records; finance uses the established finance_activity function. Bad/partial responses show an error instead of invented zeros. Counters are current-position measures; money and new requests use the selected business-date period.
- Sender display name is MIME encoded; the real verified Gmail address remains inspectable in message headers.
- Confirmation/reminder date and time are read from appointments at send preparation; begin_delivery rechecks appointment revision/status. Approved replacement generates a new confirmation and suppresses stale notices. Request contact/work content is still original_submission: there is no general owner editor for those fields, so their edit-and-notify workflow is not claimed complete.
- Invoice recipient and amounts stay attached to the approved invoice snapshot. Changing an account email does not silently rewrite historical invoices.
- Google review URL is the exact user-supplied https://g.page/r/CWxW2KabD1UWECE/review. It is enabled in the YNSG draft template and selectable in YNSG Settings only. No published settings currently exist; owner must publish settings before invoice-paid events can capture that review configuration.
- No provider email was sent or receipt confirmation fabricated. Automatic sending, recurring worker execution, inbox formatting, and authenticated mobile snapshot still require live verification.
