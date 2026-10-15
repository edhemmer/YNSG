# Invoice closeout recovery acceptance — 15 October 2026

The owner must know whether a due-date/archive correction saved, retain unsaved entries through a refresh, and record only actual received cash/Zelle. Issued charges, customer consent, tax, payments and queued messages remain canonical evidence. Stripe is excluded.

Pass/fail checklist before release:

- Define strict bounded invoice-record input and saved-response schemas; generate the OpenAPI contract.
- Keep same-origin, authenticated, tenant-scoped canonical `manage_invoice` authority and exact revision checks.
- Treat unknown database/response failures as uncertain (503), not a definite rejection (409).
- Freeze an uncertain invoice-record attempt and navigation; replay its identical body/key before allowing another change.
- Retain due-date/archive/evidence fields on conflict or failed refresh. Replace a dirty draft only after explicit discard confirmation and a successful fresh read.
- Show saved success independently of a later refresh failure; issued charges remain unchanged and no email is sent automatically.
- Warn before leaving unsaved payment or invoice-record entry. Retain entered cash/Zelle details if payment history refreshes; only reset a confirmed saved receipt or an explicitly discarded draft.
- Keep one unfinished receipt/admin edit at a time, and block competing operations while a save or unknown result is unresolved. Read-only payment refresh remains available without discarding drafts.
- Separate invoice total, received funds and remaining balance into labeled summary values without changing calculations.
- Preserve existing receipt idempotency, invoice/PDF/delivery controls, brand, readable input and light/dark appearance.
- Verify lost response, exact replay, duplicate click, stale revision, dirty refresh, failed refresh, saved success and permission/validation boundaries using isolated fixtures.
- Require full release checks, exact-head PostgreSQL CI, optimized deployment, live SHA and read-only smoke checks. Actual customer funds, mail, agreements and service completion are not created as QA evidence.

Physical phone/iPad, actual customer/provider delivery and the existing external launch gates remain separately evidenced.

The standalone invoice page now has entry protection and explicit document refresh. A document read failure retains its current view and entered receipt; a successful document refresh also refreshes payment history without replacing a dirty form. No production financial record is created to demonstrate this change.
