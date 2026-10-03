# Invoice PDF attachment checklist — October 3, 2026

Read current owner instructions, governance, A16 audit, document formatter, delivery checklist, Gmail encoder/dispatcher and package manifests before editing.

- Use the same filtered invoice document as HTML/email, exact cents, approved work, terms and frozen customer/service address.
- Preserve separate owner Send approval, tenant authorization, leases and uncertain-send reconciliation. Never enable or send live mail during development.
- Embed a licensed readable font; retain Unicode text or reject unsupported glyphs explicitly rather than silently replacing customer data.
- Paginate long descriptions and terms without clipping; repeat invoice identifier and page number; exact totals; no private reasons, recorded minutes or raw settings.
- PDF metadata contains business/invoice identity only, with no AI marketing or internal data.
- MIME attachment has safe filename, application/pdf and base64 encoding alongside HTML/plain alternatives. Validate sizes and headers before begin_delivery.
- Authenticated download uses existing invoice RLS; no public file links/storage buckets or service-key exposure.
- Pin dependencies and lockfile; verify deployment bundles font assets.
- Generate synthetic short/long specimens, extract text, render and inspect every page; check MIME round-trip and both builds.

Live Google authorization, receipt, worker activation, actual customer delivery and device acceptance remain open. Do not mark the full CRM ready.

Source review confirms invoice approval/explicit Send guards and email lease handling remain unchanged. Synthetic short and long PDFs were rendered and all pages inspected; text/bounds checks pass, including accents and exact $30.00 remaining balance. The output filters all private waiver reasons. Licensed font is packaged server-side and license embedded as a document attachment. MIME bytes round-trip with safe filename. No real customer data or live email was used. Runtime Gmail receipt and device PDF acceptance remain pending.

Final local source checks: 77 unit tests, root TypeScript, static build and CRM optimized build passed. Next server traces include the licensed font and license for both download and mail-worker routes. The original font module-resolution build failure was corrected by reading explicitly traced package assets from the runtime filesystem. PDF attachment validation checks header magic, safe filename and maximum size. This checkpoint does not prove the font filesystem path or PDF attachment receipt in the deployed runtime; designated owner verification remains necessary.
