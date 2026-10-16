# YNSG scanner / receipt / material accounting foundation — iOS handoff

Status: tested contract proposal, **not live**. No camera scanner, uploads, device permissions, stock database, automatic charge or customer invoice integration.

## Reusable code
- `apps/web/lib/barcode-receipt-parser.ts`: check-digit validated EAN-8, UPC-A, EAN-13 and GTIN-14; normalized GTIN-14 identity; rejects ambiguous camera detections; validates owner-entered/extracted receipt fields and reconciles exact cents.
- `apps/web/lib/stock-barcode-lookup.ts`: canonical barcode lookup against company-owned product records and purchase lots; returns saved product name, package size/unit, exact purchase price plus acquisition tax, remaining quantity and private receipt reference. Different cost lots remain individually selectable; no price is invented.\n- `apps/web/lib/material-lot-accounting.ts`: immutable-style pure preview of lot consumption including allocated acquisition tax, receipt pointer, current remaining quantity and customer billable portion. Not an inventory change.
- Tests: `tests/barcode-receipt-parser.test.ts`, `tests/stock-barcode-lookup.test.ts` and `tests/material-lot-accounting.test.ts`.

## iOS implementation order
1. Native camera scan using platform-supported barcode capture; relay candidate rawValue/format through the shared `parseScannerCandidates` contract. Provide keypad entry and camera permission fallback; multiple differing valid codes require choice.
2. Map normalized GTIN to a **company-owned product catalog** and resolve to the stored purchase lots using `lookupPurchasedItem`. Show product name, package size, stock count, actual cost incl. acquisition tax and linked receipt. If multiple acquisition lots exist, select the actual used lot; never silently prefer a cheaper or newer price. GTIN itself does not convey price, local tax, make/model fitness or availability. If unknown, prompt for product label and verified compatibility; never infer a retail price.
3. Photograph receipt on device, use optional on-device extraction to **propose** lines, and require one correction/reconciliation review per purchase. Verify subtotal, discounts, acquisition sales tax, receipt total and purchase date. Never equate OCR detection with actual payment proof.
4. Persist private image + company/lot/item metadata in authorized object storage, with customer/job permissions, revision/idempotency, upload expiry, encrypted backup and deletions. Track refunds/returns and excluded customer-paid supplies.
5. At job usage: scan or tap a stocked item, enter portions actually consumed, stage a draft journal allocation to the correct job; handle shelf-life and discarded remnants, negative quantities, lost connectivity, duplicate scan and mismatch. Approved scope doesn't need repeated customer confirmations, but **new charge/scope** requires the agreed change-order process.
6. Invoice draft presents a consolidated materials subtotal and original receipt evidence; review once at invoice issue. Never independently calculate additional retail sales tax on materials without the approved transaction classification.

## Business policy
Keep current hourly $60 and eligible community $45 with one combined two-hour minimum for approved hourly work; explore pre-priced repeatable services based on measured margin. No silent markup: separately billed materials at recorded cost under existing policy; insignificant consumables incorporated in overhead. Customer-paid bulk supplier purchases are not stock. Track actual procurement/drive/admin time internally for contribution margin; don't assume all of it is billable.

## Acceptance (must pass before connecting)
- Permission/ownership/tenant tests; manual camera fallback; device/iPhone/iPad accessibility.
- Product check-digit and ambiguous scan handling; pack/size normalization separate from barcode; inventory revisions and offline exact-key replay.
- Receipt parsing/reconciliation including coupon, discount, line-level tax, split payments, returns and partial lots; proper fractional allocation to exact cents.
- Independent Illinois/state transaction tax review before automatic tax.
- Staged invoice never issues itself; no duplicated usage, charge or customer message on retries.
