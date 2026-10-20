# Owner sign-in recovery — issue 153

Scope: improve the owner authentication journey while preserving existing data and permissions. This is an incident repair, not whole-product completion.

## Reviewed scope checklist

- [x] Read governing production and engineering documents and the incident.
- [x] Preserve customer data, existing identity and permissions; no schema changes.
- [x] Use one password-first form with Show/Hide and explicit Forgot password.
- [x] Distinguish temporary connection failure from rejected authentication.
- [x] Preserve existing session renewal and origin/permission boundaries.
- [x] Exercise sign-in, membership, inbox, full request note and decline editor with synthetic fixtures, without sending customer messages.
- [ ] Pass exact-head required CI and production builds, then merge the tested head.
- [ ] Verify actual deployments and read-only owner workflow.
- [ ] Obtain owner confirmation on the actual phone before closing the incident.

## Resulting behavior

Forgot password uses the existing password-reset operation. It no longer starts a sign-in-code flow under a recovery label. Error text points to available controls. Duplicate in-flight form submissions are blocked. A temporary identity-provider outage returns a retryable error, preserving saved access. Membership enumeration excludes revoked access, while existing database permission checks remain authoritative. Retired embedded sign-in handlers are removed.

## Verification and release

`tests/owner-signin-experience.test.mjs` exercises the connected owner journey using synthetic records. `tests/session-provider-boundary.test.mjs` covers outage classification, authentication rejection, cookies and origin checks. Existing session, permission, customer workflow and database tests remain required.

Follow the normal exact-head release process into the existing production branch. Verify both custom domains and the authenticated owner journey. Actual account-recovery operations and private evidence remain outside public Git. Leave issue 153 open until the owner confirms physical-device access. Rollback changes code only and preserves customer records.
