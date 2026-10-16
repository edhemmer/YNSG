# Mileage capture — WEB-08 staged acceptance

This foundation adds a pure, validated mileage data contract. It does not yet save trips to the database or claim a deduction.

## Owner workflow for a future mobile and CRM implementation
- Start/end odometer readings are owner-recorded and remain auditable; a route estimate or Google Maps distance is **not** automatically treated as observed mileage.
- Classify business, personal or mixed requiring review. Mixed and personal miles are excluded from business-mile totals until an approved corrected record exists.
- A job association is optional. A supplier detour can be recorded as a separate trip with a reason, without automatically billing the customer or automatically allowing a tax deduction.
- Supplier pickups, commuting, moving between business sites, and other trip types may have different tax treatments. Do not infer deductibility from a "business" tag; keep deduction estimates disabled until reviewed current-year law, filing context and accountable business inputs are available.
- Enter once on phone with meaningful defaults, but require explicit odometer and purpose values. No separate confirmation buttons for every field.
- Eventual persistence must use exact-key idempotency, tenant authorization, immutable correction/reversal history, privacy-sensitive location handling and tax-report reconciliation.

## Remaining engineering to close WEB-08
Implement authenticated create/read/reversal commands, database migrations and transaction-level export; prove RLS, same-org isolation, exact retry and real report integration. Follow with actual owner/accountant classification and IRS/Illinois tax source review before displaying deductions. No gate is closed by this contract alone.
