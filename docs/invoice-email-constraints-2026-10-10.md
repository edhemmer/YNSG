# Invoice and email review checklist

Reviewed active requirements and current invoice, sample suite, branding and email sources before changes.

| Requirement | Acceptance |
|---|---|
| Official logo | Existing approved asset on web invoice, PDF and business emails; no generated replacement |
| Layout | Centered email headings, clear customer/work/totals/terms grouping, readable mobile and dark mode |
| Accounting | Preserve exact cents, taxes, confirmed payments, balance and sample labels |
| Links | Review opens configured public review page; owner links retain authentication; customer actions retain existing secure authorization |
| Samples | Real review destination visible, explicit sample notice; appointment preview actions cannot alter actual records |
| Security | Escape dynamic markup; no credentials in output or public code; no weakening authorization |
| Copy | Ed not Edward; no Request help, no new guarantees or false paid status |
| Deployment | No Production-ready claim without actual acceptance; inspect branch/environment behavior without guessing |
| Verification | Full tests/types/build plus visual PDF/email/web check and live link destinations |

Reviewed complete changed invoice/PDF/email sources against this checklist. Full 222 tests and root/web TypeScript checks pass; optimized webpack build passes. PDF was rendered and visually inspected; live invoice email and web invoice show the official logo and clear grouping. The configured Google review destination opened the correct business review form directly, with no CRM login. Sample run 330ace17-1362-4691-b9c5-81985c2a3ca0 uses the corrected public review link and saved completion terms. Source 4d9c9863 is READY and serving .app using its existing Preview branch configuration.

Owner/contact/map and customer token/action destinations pass source/contract tests. Real customer appointment/email-token expiry and phone inbox rendering have not all been re-exercised in this release; do not claim every live integration is accepted. Production branch/environment activation remains open: Vercel denied branch-scoped variable metadata reads with HTTP403. Branch-specific Preview overrides and independently scoped Production values are distinct. No secret was published and no authorization was relaxed.

No whole-product Constraint check passed or final production certification is claimed.
