# Customer accounts and request buttons — 2026-10-26

Scope: Ed's request for uniform working service-request buttons and customer sign-up/sign-in, requests, appointments, history and invoices without stored payment credentials. Baseline e10e9080579c6283d093efc6e8d0435c4934c678. Advances WEB-02, WEB-06 and WEB-10; does not certify unrelated production gates.

## Pass/fail acceptance checklist

- [x] Every public page uses the same request-button renderer and style; header, hero, content and footer agree on color, dimensions, label, focus and destination.
- [x] Rendered buttons work at phone/tablet/desktop widths, both themes, keyboard and enlarged text; no clipped label or horizontal overflow.
- [x] Customer sign-in and sign-up are visible from every public page; guest requests remain available.
- [x] Sign-up, email confirmation, password sign-in, saved-session renewal, recovery and logout preserve existing owner authentication.
- [x] New verified customers can save their own contact/address and send a linked service request; returning customers reuse saved details.
- [x] Existing records require an explicit invitation; no email matching, household merge, privilege escalation or access to other customers/companies.
- [x] Request/appointment status, service history and issued invoices/PDFs are visible to the authorized customer, with empty/error/retry states.
- [x] No card numbers, security codes, bank credentials or payment methods are collected or stored; existing invoice totals and cash/Zelle receipt accounting remain.
- [x] Profile/request commands validate bounded inputs, live identities, revocation, idempotent replay and interrupted responses; synthetic database and browser tests pass.
- [x] Approved logo, service scope, pricing, calendar rules, optional accounts, no Google login, no required MFA and no paid activation preserved.
- [ ] Full release checks, builds, exact-head PostgreSQL CI and live read-only deployment checks recorded before shipping claims.

## Contract

`POST /api/account-profile` accepts `{key: UUID, profile: {name, phone, street, city, postalCode}}` only. Company comes from the deployed public scheduling configuration; email comes from the verified live identity. The canonical `create_customer_profile` command creates one new self-owned customer/contact/address, records an actor-bound receipt and audit event, and never claims existing records. An existing or revoked relationship blocks new self-enrollment. Exact replay returns the original receipt while access remains valid. No communication or booking occurs during profile creation. Appointment submission uses existing `submit_customer_request`; owner confirmation is still required.

## Engineering validation

Tracked by issue #204. Local `npm run verify:release` passed 932 tests, type checks, lint, contracts, migration fixtures and production dependency audit. Public website metadata/local-link checks and the optimized Next.js build passed. Chromium exercised 17 public pages at four widths in light/dark mode plus enlarged text (153 cases), checking consistent computed request-button styles and clicking each page's request entry into the real form. Built customer-browser checks exercised registration, PKCE confirmation, own profile HTTP command, linked request, exact lost-response replay, appointment/request status, service history, invoice link/balance, logout and password sign-in at four widths in both themes. All providers/data were synthetic; no production mail, booking, work or receipt was created.

The new private enrollment command shares the account-deletion identity lock and organization lock, grants no staff membership, rejects revoked relationships and never matches preexisting customers by email. Native PostgreSQL CI includes two independent connections enrolling the same actor/key and asserting one record and identical replies. Deployment/migration evidence follows the reviewed PR. Real auth-mail inbox delivery and physical-device acceptance remain open in the production register; these are not inferred from synthetic checks.

## Production decision

PR #205 targets the existing `codex/crm-workflow` production branch. Confirmed Vercel team `team_xJdK8KY6YHsYD1Pu8Iu5C7aD`: project `ynsg` serves the .com website and `ynsg-repo` serves the .app account/owner application. Both were on baseline e10e9080579c6283d093efc6e8d0435c4934c678 before this work. YNSG database project is `jvigtwjlkmeyavzbxjzl`; read-only inspection confirmed the intended active company and intake configuration. No customer records were extracted for QA.

Automatic approval review rejected applying `customer_self_service_profile` to production because it changes live customer-access behavior and requires explicit rollout authorization. The action was not applied. The source migration and pending history entry are prepared; PR remains unmerged. Requested decision: authorize applying `20261026131540_customer_self_service_profile.sql`, verifying its catalog/permissions, updating the observed migration map, then merging/deploying the tested PR #205 head after required CI passes. Follow with read-only verification of both domains and the account entry points. Keep guest intake available and do not create production QA customers, mail, bookings or payments.

Real signup confirmation/reset inbox delivery still requires an owner-authorized test recipient. No provider delivery or whole-product certification is claimed by the engineering checks.

## Approved rollout continuation

Ed explicitly approved the changes and production rollout on October 26, 2026. The previous automatic-approval blocker is resolved by that instruction. The prior full CI run was canceled at its 15-minute job deadline while Ubuntu's Azure package mirror downloaded browser dependencies at a few kilobytes per second; application release checks/builds and native PostgreSQL had passed. The scoped CI repair uses Ubuntu's signed official HTTPS archive for that mirror, installs only the Chromium headless shell used by the tests plus WebKit, and gives the expanded browser matrix 25 minutes. Both browser engines and all existing tests remain required. Apply the prepared additive migration and release only after the repaired exact-head checks pass; verify permissions, both live deployment SHAs and read-only account/button behavior afterward. No signup emails or synthetic production records are authorized by this approval.

## Verified migration and release checks

Full exact-head CI passed at 7b32f0638686ecc40d7e9e14d1f35df81027f831: https://github.com/edhemmer/YNSG/actions/runs/40337607588. This includes native PostgreSQL enrollment concurrency, 932 application tests, both browser engines, customer registration/history, owner authentication, complete field request-to-receipt journeys and native foundation checks. Browser enlargement is measured after the browser completes style/layout; the shared typography uses an explicit font-size property.

After Ed's approval, `customer_self_service_profile` was applied to the intended YNSG project as observed history version 20261026142455. Both stored function bodies match the source (private MD5 be54b69b4d52a0c9391de3379eb882e5; public MD5 6b3ce0340a09f56a711ef3cc3287d30e). The public wrapper is security invoker, the private implementation is security definer with locked search_path, authenticated execute is allowed, and anon/service-role execute is denied. Existing advisor findings remain unchanged: eight private-table informational notices, the existing pg_net schema warning, twelve existing exposed owner command warnings and disabled leaked-password protection. No new advisor finding was introduced by this command. The complete migration-name/version map matches the observed catalog, including the new entry.

The migration added functions only; no customer, contact, property, appointment, communication, invoice or payment record was created by this rollout. Merge/deployment/live read-only evidence is recorded in PR #205 after the final reviewed metadata head passes CI. Google search visibility is separately tracked in issue #206 and is not inferred from crawlability checks.
