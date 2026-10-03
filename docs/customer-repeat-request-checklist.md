# Customer repeat request acceptance — October 3, 2026

Reviewed active owner requirements, governance amendments, canonical audit, portal/session routes, RLS relationships and multi-service intake transaction before edits.

- Verified live customer identity and explicit company/customer relationship; no matching an account by email to create access.
- Select a stored property and the verified user's linked contact; only permitted records exposed. No repeated name/address/phone/email typing.
- Preserve multiple service categories, optional note/time preference and self-declared community inquiry. No appointment or rate guarantee.
- Durable atomic request, selected items, audit, owner notification and idempotent receipt. Retry unchanged input once; edited input receives a new key.
- Validate body size, strict input, service catalog, contact completeness, configured city and intake activation. No client-selected contact strings or privileged keys.
- Deny other tenants, unrelated properties, unverified/revoked identities and anonymous access. Saved-contact changes do not duplicate a successful retry.
- Simple labeled controls, large targets, keyboard semantics, loading/errors and success states; no customer owner-workspace navigation.
- Customer invoice links use existing authenticated document routes, never public storage.
- Database fixtures, request validation tests, TypeScript and optimized build; real phone/customer login, Google receipt, calendar selection, website login and optional post-request signup remain open.

Verified in automated checks: 82 unit tests, PostgreSQL atomic/retry/tenant fixtures, TypeScript and optimized build. Hosted migration applied; anonymous and general-worker execution denied, explicit relationship and persisted customer/property verified. No real customer request created or email sent. Browser/device acceptance and public activation remain pending.
