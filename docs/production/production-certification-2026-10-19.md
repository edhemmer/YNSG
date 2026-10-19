# Production verification and certification scope — 19 October 2026

Controlling scope: `AGENTS.md`, production charter/execution/acceptance and completion register; WEB-06/10/11/17, #32/#33 and IOS-02/#38. Prior PR #136 is deployed at 418ae57043d87f5f756ee09f0efd23e0093f4342. This pass continues engineering and distinguishes reproducible build checks from owner, device, legal, provider and independent-human certification.

## Pass/fail checklist before edits

- Preserve approved brand, services, rates, optional accounts and issued/original evidence. No required MFA, Stripe, paid activation or production QA mutation.
- A privacy command with an unknown response retains one exact body/key. Reload, pagination, editing and navigation cannot substitute a new command. A named definitive rejection permits correction; reauthentication permits exact retry.
- Policy/legal-hold drafts survive read failures and refresh. Unknown commands freeze reviewed fields; existing original policy revision remains the publication baseline until saved or explicitly discarded.
- Duplicate taps are blocked synchronously. Late reads cannot replace current company/form state. Known deletion completion is shown only after validated provider-backed status.
- Receipt recovery must remain usable without a signed-in account and cannot sign out an unrelated current account. Deleted-account completion removes cached signed-in history for that same request only.
- Processing labels must say processing, not imply completed identity deletion. Forms retain labels, narrow-screen reflow and visible errors/retry controls.
- Add a reproducible certification runner that records the exact clean local commit/tree, each check and actual nonzero failures. Full web/iOS/scale gate failures and native audit findings remain failures; never certify from a test count or suppress a gate.
- Run bounded synthetic interaction/API tests, full release checks, optimized builds, native checks/audit and required exact-head PostgreSQL CI. No real account deletion, provider email, booking, invoice or funds for QA.
- Commit all changes to GitHub, merge only the tested head, verify both deployment projects/SHAs and four aliases, then read-only live checks. Keep actual owner/legal/device/human decisions open.

Rejected: clearing uncertain attempts on read, silently publishing edited retry bodies, mapping unknown saves to definite rejection, deleting another account's cookies through a receipt, invented legal/device/Apple certification, unsupported dependency overrides, documentation-only completion claims.


## Verification command

`npm run certify:production -- --output /tmp/ynsg-certification-<unique-name>.json` requires a clean committed source and refuses to overwrite an existing report. It runs release tests/types/contracts/audit, both optimized web builds, native types/lint/SDK/iOS bundle/audit, native evidence validation and all three milestone gates. Independent checks continue after a failure. Source commit/tree/cleanliness are checked again at the end. A successful machine pass is only `ready_for_evidence_review`; any failure is `blocked`. The runner cannot assert independent legal, Apple, human-review, provider, owner or physical-device certification. Remote CI, migration and deployment proof must be verified separately and linked in the release PR.

Current fresh native audit reports two high findings (`node-forge` GHSA-86w9-cpqp-85rv; `braces` GHSA-vfj7-8cjw-p6xm) without published patched versions and one moderate `uuid` finding through the Expo/xcode toolchain. Existing supported SDK checks remain required. Do not suppress these, force incompatible overrides or distribute native builds. Primary advisory records: https://github.com/advisories/GHSA-86w9-cpqp-85rv ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm ; https://github.com/advisories/GHSA-w5hq-g745-h8pq .

This batch changes no schema, services, prices, provider activation or financial records. It preserves deployed account deletion and retention semantics while correcting recovery and browser/session isolation. Build and certification outcomes are recorded only after executing the checks; no milestone is pre-certified by this document.


## Whole-flow engineering review

Reviewed Account → optional sign-in → privacy request/confirmation/recovery and Settings → policy/hold/request/retention review, including failure and stale-state paths. Unknown commands retain their original input/key; definitive rejection is typed separately; fresh sign-in keeps exact replay. Refresh/pagination cannot erase a pending attempt or replace a dirty policy baseline. Fieldsets freeze reviewed fields while reauthentication/retry remains reachable. Local drafts are guarded before leave; account sign-out uses that guard. Company changes remount the editor; owner revocation hides privileged controls while local drafts remain protected. Receipt processing does not require session authority, but cookie cleanup requires matching own-request proof. Only validated same-account completion clears cached history. Processing has an explicit processing label.

Review exclusions remain unchanged: original evidence is not erased; no policy periods, approval, actual work/funds, provider delivery, Apple/device or independent review are manufactured. There is no new migration. The reproducible runner preserves every failing audit/gate and cannot grant certification by itself. Exact source, runner outcomes and final release mapping are recorded in the release PR after execution.
