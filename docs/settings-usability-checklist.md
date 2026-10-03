# Settings usability and field-day audit acceptance

Latest owner direction: use Business name, never Seller in owner-facing copy. Fix the screenshot's setup controls, then continue canonical audit. Governing business/design requirements and October 3 email-only owner access remain in force.

- Business name label and clear distinction from customer-facing name; no Seller in rendered owner setup or commercial instructions.
- First/last arrival and finishing time shown as ordinary local clock times. Weekdays named and selectable.
- Short durations explicitly in minutes; longer durations in hours. Preserve exact canonical minute values, null/unreviewed values, timezone, 24–36-hour booking window and 2-hour decision deadline.
- Accessible grouped controls, large targets, readable helper text, mobile single column, no horizontal overflow.
- Business-name confirmation separated from tax review. Tax status defaults to unreviewed; no automatic legal/tax certification or unsupported taxable invoicing.
- Configuration publication remains explicit, revision checked and idempotent. Editing disabled during publish; no provider/intake activation inferred.
- Review whole settings page, validation messages and preview; retain catalog, required fields, colors/contrast checks and published histories.
- Continue A13: owner-only full daily call list independent of dashboard pagination; contact/address/all requested tasks, print and navigation. No invented packing equipment, optimized route or automatic notification claims.
- Run relevant unit/authorization checks, TypeScript and production build. Real phone, screen reader, live owner access and provider delivery remain acceptance gates.

Results: 54 unit tests pass, including clock labels/custom times, Chicago midnight/DST, international date envelopes, invalid dates, navigation address encoding and all selected tasks. Root TypeScript passes. Hosted composite request FK matches the day-plan join. All database fixtures and the optimized CRM build pass. Deployment is being verified. No business rules, live provider controls or schema identifiers were renamed.

A13 is partial: daily call sheet, printing CSS and navigation links are implemented; automatic daily notifications and A14 equipment packing remain open. Actual owner session, real records, mobile layout, screen reader, print output and Maps handoff require live acceptance. No claim of completed production release.

Navigation follows Google’s documented Maps URL format: https://developers.google.com/maps/documentation/urls/get-started . It requires no embedded Maps API key; location availability/permission is controlled by Maps and the device.
