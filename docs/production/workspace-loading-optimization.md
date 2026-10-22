# Workspace loading optimization

Scope: WEB-10 / #176 and sample-mail preparation, based on `be927895494c16e7b211a901434f6edad3a13da2`. This maintenance update preserves the full production register and field operating system requirements.

## Constraint checklist

- Preserve current owner controls, official brand, pricing, service boundaries, tenant permissions, canonical commands and retained customer/financial evidence.
- No Google login, required MFA, Stripe activation, paid services, decorative AI narration or production test mutations/messages.
- Load secondary code when needed; closed expense/mileage tools perform no initial report reads. After first opening, closing retains drafts, uncertain attempts and navigation guards. Company changes discard only through the existing guarded transition and mount fresh tools for the selected company.
- Provide accessible loading status; retain current empty/error/recovery states and all working entry points.
- Queue sample mail without generating an unused PDF/MIME message. Prepare worker PDF bytes once before claiming delivery; retain recipient/membership validation, compare-and-set claim, replay prevention and ambiguous-send reconciliation.
- Full release checks, optimized builds, responsive behavioral verification and exact-head native PostgreSQL CI remain release requirements. Physical-device and provider acceptance remain separate gates.

## Result

Reports, customer tools, settings, privacy, field guide, expense and mileage code use explicit dynamic import paths. Native disclosure controls mount expense/mileage content on first opening and retain it thereafter. No saved command, database schema, provider configuration or permission changes.

Sample queue POST no longer builds a discarded PDF and MIME email. The worker reuses its prepared attachment instead of rendering it again for business transport. Existing preparation failure, claim conflict and uncertain delivery behavior remain intact.

The baseline rendered workflow test still expected the removed duplicate “Start work timer” label. It now asserts exactly one current primary “Start work” control, preserving the approved single-action field workflow.

## Local validation

- `npm run verify:release`: 909 application tests, contracts, root/CRM types, migration/lifecycle assertions and clean production dependency audit pass.
- `node scripts/build.mjs` and `pnpm --dir apps/web exec next build`: pass.
- Chromium full-shell navigation suite: 42 checks pass. Added first-open read deferral, collapsed draft preservation, canceled navigation and company-switch isolation. Existing session revocation, exact timer recovery, six widths, light/dark and 200% text cases pass. All APIs are isolated synthetic fixtures; zero production writes.
- Sample worker tests cover real generated sample PDF bytes through business transport, accepted/uncertain outcomes and no second delivery.
- Controlled minified esbuild split-bundle comparison using the same workspace harness: initial static JavaScript graph decreases from 1,215,309 to 1,047,216 bytes (168,093 fewer bytes). This measures that harness, not real-device loading time or a Next.js transfer-size claim. The optimized Next.js build separately succeeds.
- React review: imports and loaders are module-scoped, paths statically analyzable, loading is announced, disclosures remain native keyboard controls, company keys isolate state, and retained mounted children preserve draft/unknown-command guards.

Required CI supplies both browser engines and native PostgreSQL evidence for the PR head. Local Chromium used an isolated temporary binary because the standard browser archive download was truncated; no repository dependency or browser-engine requirement was changed. This record does not mark WEB-10 or whole-product acceptance complete.
