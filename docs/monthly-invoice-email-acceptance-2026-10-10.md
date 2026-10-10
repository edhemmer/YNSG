# Monthly invoice numbers and premium email acceptance

Before work: invoice IDs are independent from display numbers; invoice totals, ledger, tax treatment, confirmed payments and historical numbers must remain unchanged.

- Implemented and checked: new issued invoices show YYYYMM-0001; monthly counter is per organization and frozen using seller timezone at issuance.
- Implemented and checked: issuance serializes concurrent allocations; retry returns same invoice; month/year rollover works; archived invoices never recycled.
- Implemented and checked: owner lists, customer lists, email, PDF and filenames agree.
- Implemented and checked: shared approved-logo template has clear centered headings, grouped details, readable phone layout and dark mode.
- Implemented and checked: declined-time message clearly requests another date/time; replacement remains subject to approval.
- Implemented and checked: customer sample buttons open a public, harmless demonstration instead of private owner Production Checks; real customer links retain scoped tokens; owner tools remain authenticated.
- Implemented and checked: tests, database assertions, types and production build; deployment evidence recorded separately.

Validation: 226 unit/template tests pass; empty-schema migrations and PostgreSQL business assertions pass, including issuance retry, per-organization isolation and local December/January rollover. Root/web TypeScript checks, website syntax/static build and optimized Next webpack build pass. PDF visually inspected: full 202610-0001 identifier on one line, approved logo and one-page sample with unchanged $120.00 total. Live migration applied and read-only allocation returned October, December and January first numbers. Anonymous/authenticated roles cannot directly call the private allocator. Issuance uses the existing per-organization transaction lock; multi-connection stress testing is not claimed. Legacy snapshots without timezone retain the existing UTC fallback; configured seller timezones are used. Maximum monthly sequence is 999999; allocation fails instead of colliding at capacity.

Deployment and actual inbox acceptance pending until serving builds and samples are checked. Owner links intentionally require authentication. Customer demonstrations contain no real request details and cannot mutate customer records. Existing sample email deep links redirect to the harmless demonstration when unauthenticated; private diagnostics stay protected.
