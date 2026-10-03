# Invoice document acceptance — October 3, 2026

Scope: authenticated printable issued invoice, part of A16. Latest owner directions, governance, audit and invoice source reviewed.

- Use immutable invoice snapshot and actual payment postings; never recalculate issued charges from current rates.
- Display business name, invoice number, recorded work including no-charge items, issued total, payments, balance and approved terms.
- Exclude internal waiver reasons, quote configuration, private notes and payment references.
- Require authenticated invoice RLS and explicit tenant filter. Never expose a service key or a public invoice capability.
- Use React-escaped content and simple accessible mobile/print controls.
- Test cent calculations, zero charges and missing/invalid snapshots; run TypeScript and optimized build.
- Email send action, PDF attachment, provider receipts and paid thank-you remain incomplete; no live mail is activated.

Results: 65 unit tests, root TypeScript and optimized CRM build pass. Document sanitization, waived work, exact balances and invalid totals are tested. Real browser/print layout, customer address presentation and live email/PDF delivery remain open; this is a document preview, not full invoice release acceptance.
