# Request recovery — October 8, 2026

Scope: continue the existing CRM branch from a9de7be. Review the full changed files and the source/test/build outputs against these constraints before committing.

| Constraint | Acceptance |
|---|---|
| Existing brand, official logo, service catalog, rates and contact requirements | No changes to assets, page copy, pricing, service allowlists or required fields |
| Optional customer accounts and owner approval | No account requirement or confirmed-booking claim added |
| Unknown submission outcome | Retain the exact submitted body/key; prevent edits and reservation changes until a definitive response; allow retry and phone/email fallback |
| Definitive rejection | Restore the original enabled states; refresh availability on a reservation conflict |
| Temporary hold lifecycle | Clear released selections on page exit; check expiry when returning to the page; never release an uncertain submission or saved request |
| Accessible controls | Preserve labels, focus, live status and press/click instructions; explain retry behavior plainly |
| Automated regression coverage | Include non-browser .test.mjs files; repair stale calendar fixtures to exercise the actual hold flow |
| Private information | No keys, credentials, customer IDs or diagnostics displayed or committed |
| Deployment and external systems | No main/DNS/provider/database changes, customer messages or paid upgrades; prepare isolated source changes |
| Honest verification | Separate local checks from real-device, concurrent booking, provider delivery and production acceptance |

Review result: the complete changed files and generated static output satisfy this batch’s constraints. All 154 tests, both TypeScript checks, website syntax/build, CRM build, and database fixtures pass. No live provider or device acceptance was performed. Remaining overall product gates are preserved in the current build checkpoint; this is not a production certification.
