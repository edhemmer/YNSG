# Invoice delivery checklist — October 3, 2026

Read active owner instructions, governance, A16 audit, current issuance/recipient snapshots, invoice UI, dispatcher and lease/company-selection functions before editing.

- Approval fixes charges; sending requires a separate explicit owner/admin action and recipient review.
- One logical delivery per issued invoice, stable event key and command retry receipt; no automatic re-send.
- Only same-company approved issued invoice with immutable recipient may be queued.
- Receipt-tested tenant Gmail must be enabled before queuing; no consent or activation performed by migration.
- Invoice.issued remains unsupported as a delivery event; only invoice.delivery is sent.
- Record pending/accepted/failed/needs-reconciliation accurately; accepted means provider accepted, not proven inbox receipt.
- Preserve lease/begin/finish guards and no blind retry after unknown send result.
- Include full readable invoice, exact charges, payments/balance, terms and business/customer details; exclude private waiver reasons, recorded minutes, notes and settings.
- Owner controls hidden from customers; server authorization remains decisive. No raw payment details.
- HTML and plain text emails only in this increment. PDF attachment remains unfinished and must not be implied by UI or reports.
- Verify authorization, duplicate suppression, disabled mail, template/MIME safety, database suite, both builds and deployment. No real customer email sent during development.

Live Gmail consent, sender receipt, recurring worker activation, actual delivery and phone acceptance remain open. Do not mark A16 complete.

Automated checkpoint: 75 unit tests, the complete PGlite migration/integration suite, root TypeScript, static-site build and CRM optimized build passed. Hosted YNSG migration verified anon/worker cannot request delivery, authenticated entry remains internally owner/admin guarded, explicit delivery is leasable and issuance is excluded. No mail activation or real invoice email occurred. Live tests above remain pending; this is not a release certificate.
