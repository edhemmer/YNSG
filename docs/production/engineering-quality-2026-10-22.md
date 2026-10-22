# Engineering quality upgrade — October 22, 2026

Baseline: `b1a027178fdfc56615c2d8a05222cfd09b6b0913`, production branch `codex/crm-workflow`. Advances WEB-10 / #176, the WEB-06 private-file read boundary, and WEB-11 engineering checks. Existing gate acceptance remains authoritative.

## Pass/fail checklist

- Preserve all 28 gates and R01–R21, original customer/financial records, company permissions, canonical commands, approval/replay protections, branding, pricing and service boundaries.
- Preserve the recovered sign-in flow, optional accounts, drafts and current one-action field controls. No Google login, required MFA, live Stripe, paid activation, decorative AI claims or production test messages/mutations.
- Pin compatible stable packages and retain the frozen lockfile and production dependency audit.
- Enforce core JavaScript/JSX correctness, fundamental Hooks rules, complete effect dependencies and unused-code checks in release validation. Fix source findings without inline lint suppressions.
- Preserve current generation invalidation, aborts, unknown-save recovery and drafts during effect cleanup. A scope change must never restore the prior customer's private-file page.
- Review the whole change and connected workflows; require full automated release checks, optimized builds, responsive browser/authentication tests and native PostgreSQL CI before merge.
- Verify the tested head, merged source tree, production deployment SHAs/aliases and read-only live health. Keep actual device/provider/human acceptance distinct.

## Implementation

Next.js is pinned at stable 16.4.2, with matching framework artifacts in the lockfile. The upstream release includes Turbopack consistency and lazy-import fixes: [official release](https://github.com/vercel/next.js/releases/tag/v16.4.2). React and the isolated native dependency graph retain their existing versions.

`npm run lint` uses pinned Oxlint 1.89.0. Fifteen explicit rules cover Hooks order/dependencies, unused bindings, JSX keys/duplicate props and core JavaScript correctness. This syntax-level checker supports the existing TypeScript source without depending on a TypeScript compiler API. Root and CRM TypeScript configs additionally enforce `noUnusedLocals` and `noUnusedParameters`. `verify:release` now runs lint, so public/CRM builds and existing release CI enforce it automatically. A synthetic negative control verifies rejection of conditional Hooks, missing dependencies and unused bindings.

Unused imports, dead workspace scheduling code, unused state triggers and temporary bindings are removed. Existing scheduling entry points still call their guarded canonical handlers. Required awaited validation/provider calls are retained.

Read functions in customer records, finance, notes, calendar, privacy, payments and tax tools use callbacks with explicit scope dependencies. Cleanup captures the stable ref containers and invalidates their latest generation; it preserves the original cancellation/replay behavior. Invoice tax-review inputs are sampled through an Effect Event when a saved job revision loads, so typing does not restart the remote read or clear the review. Mileage resets sample the current date only when the selected organization changes.

Private-file pagination now keys reads to the organization, customer and primitive job/invoice filters. A scope change resets the prior page/cursor and rejects late responses; equivalent filter objects do not refetch on ordinary renders. Manual tools stay idle until opened/refreshed. New tests cover stable filter identity, changed scope, late completion, unmount and manual reads.

Customer file/export/import siblings now use distinct scoped keys. The old refresh test parsed a function's source spelling; its replacement exercises the actual workspace and proves transient failures keep mounted tools while denied reads remove protected data.

## Verification

Run `npm run verify:release`, `node scripts/build.mjs`, the optimized CRM build and the existing public/authentication/mobile/workspace browser checks. Required CI runs Chromium and WebKit plus native PostgreSQL lifecycle, concurrency and recovery. Release results and exact candidate/deployment mapping are retained in the PR. No database migration, provider configuration or financial command changes are included.

The local production-runtime authentication test uses an isolated synthetic Auth provider and verifies native sign-in, PKCE recovery, password save, secure-cookie redirect, same-account denial and fresh owner access. It is not owner-device or real email-delivery evidence.

References: [React effect dependencies](https://react.dev/learn/removing-effect-dependencies), [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config-file-reference), [Oxlint Hooks dependencies](https://oxc.rs/docs/guide/usage/linter/rules/react/exhaustive-deps).

Local candidate results: full release validation passes with 912 application tests and zero failures, clean production dependency audit, generated contracts, strict root/CRM types and PGlite lifecycle/migration assertions. Lint reports zero findings across 625 files with all 15 configured rules. Optimized public and Next.js 16.4.2 CRM builds pass. Chromium passes 150 mobile workflow checks, 42 workspace checks and 16 public-page checks. The production-runtime synthetic authentication suite passes. Native PostgreSQL and both-engine CI are required on the published head before merge; physical-device and provider acceptance remain separate.

Final render-boundary review adds a synchronous scope check: private-file metadata is hidden on the first render after an organization/customer/filter change, before passive effects reset state. Cursor refresh/retry/next/previous actions also use only positions belonging to the current scope. The regression records every rendered hook result and verifies that an old customer, organization or job filter is never exposed during those transitions.

The final render-boundary correction passes its targeted scope tests, lint and CRM typecheck. The full local suite results above precede that last correction; the corrected immutable head requires a fresh full CI run before merge, with final evidence recorded in the PR.
