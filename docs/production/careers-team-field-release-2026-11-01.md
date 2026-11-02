# Careers, office assignments and field closeout

Release review in progress, November 1, 2026. This is an engineering release record, not acceptance of every WEB/IOS/SCALE gate. No real applications, customer messages, work, approvals or payments are manufactured for QA.

## Owner decisions implemented

- Home/yard labor defaults to $60/person/hour or $45/person/hour Community Rate. Only the first person has a two-hour combined-visit minimum. Three people each working one hour at Community cost $180. Each person's actual minutes are retained separately. A rate adjustment or waiver needs a reason and stays within the customer's approved financial cap. YNSG manages staffing; crew size is not a customer approval step.
- Every lead defaults to Owner. Office owners/admins manage technician names, phone numbers, emails, access, handoffs and assignment filters. Assignment is separate from customer communication, a commercial agreement and an appointment. Archived technicians' leads return to Owner; their business Technician membership is revoked and history retained.
- The office owns follow-up, quotes, acceptance, scheduling, confirmations, tax setup and administrative messages. A current primary assigned technician has a focused Work screen: authorized visit → work timer/notes → individual labor charges → complete actual work → issue reviewed invoice → collect/record actual cash or verified Zelle. Additional authority over tax rules, credit notes, refunds, marketing and other jobs is not granted.
- A contact alone grants no login authority. An office manager can explicitly activate the exact saved, verified account email as Technician. The person creates/verifies their own account; activation neither creates a fictitious identity nor sends an invitation. Existing different staff roles cannot be silently overwritten. Account activation is a permission decision, separate from a lawful hiring/work arrangement.

## Connected implementation

Canonical SQL owns rate snapshots, labor validation, role activation, assignment revisions, invoice approval and received payments. Original requests, approved quotes and issued financial snapshots are retained. New crew quotes use a separate command so legacy receipts and agreed prices keep their prior meaning. Invoice lines preserve actual minutes, billed minutes, normal/final rate context and adjustment reason.

Office request filtering is applied before pagination. Owner and technician notes are read from the same private job records. Current membership and job assignment are rechecked after waiting on consequential job locks. Assignment/archival and field writes use compatible lock ordering. Unknown team actions, field notes/timers and received payments preserve actor/target/key/body-hash metadata and reconcile the same attempt. Recovery stores neither resumes, application answers, contact profiles, job notes nor payment references in the browser.

Tax setup remains with the office. A technician can issue only when the retained agreement and current office tax assessment permit it; changed work or stale tax review requires the office. Cash/Zelle entries require explicit actual-receipt confirmation. No card processor or paid AI is activated.

## Recruiting and discovery

Public `/careers`, `/careers/small-home-jobs` and `/careers/yard-work` have distinct local metadata, canonical URLs, sitemap inclusion, breadcrumbs, direct role-specific applications and internal links. The application host stays noindex. Interest-based recruiting pages use a truthful directory schema rather than fabricated Google JobPosting vacancies. Search ranking/indexing is not claimed as an automated-test result.

The private owner-only Hiring inbox retains original experience, skills, availability, contact details and optional bounded PDF resume. Status/contact notes are explicit human actions; opening a draft is not delivery. No applicant scoring, automatic rejection or hiring by AI. No initial ID, SSN, convictions, health, salary-history or military-proof upload. Applications and customer marketing lists remain separate. Only the owner can download resume bytes, through a scoped audited attachment response with verified size/hash.

Home/yard recruiting is interest-based, with no public hiring wage, contractor-classification assertion or guaranteed hours. Farm-crew recruitment remains outside the board pending applicable registration/exemption, classification and safety review. Owner-operated farm service inquiries and their existing separate day-rate boundaries remain unchanged. Posting intake pauses when the declared employee threshold reaches 15, its review expires or the owner pauses it. Private owner legal-readiness research is outside Git.

## Verification and release evidence

Local schema/contract/type/lint and empty-schema PGlite lifecycle checks cover Owner defaults, activation, assignment/reassignment, tenant/role denials, quote replay, actual/billed minutes, $180 default/$165 adjusted examples, field-issued invoice audit, actual receipt, balanced journal, retained notes and revocation.

Dedicated real-component Chromium checks currently cover 40 careers/labor stages and 28 Team/assigned-field stages at phone/desktop widths in light/dark themes, including lost-response reloads. Findings: zero text-readability or horizontal-overflow failures in those cases. These fixtures are synthetic and are not actual provider or physical-device proof.

Release requires final exact-head Linux application/browser/native PostgreSQL CI, production build, migration-name/history verification, tested-head merge and both-domain deployment SHA/read-only smoke. Do not describe this file's in-progress record as a completed deployment. The completion register's independent human security, actual device/provider, business/legal and native distribution gates remain separate.

## Owner-approved durable print identity

All new print artwork and signage contain only the approved logo, “We’re Here to Help.” tagline and YourNeighborhoodServiceGuy.com. The current downloadable layout master is `site/assets/brand/ynsg-logo-tagline-website.svg`; it embeds the original logo, so print resolution still depends on the intended physical size. Digital contact details use the owner-approved 815-680-1775. Retained issued financial snapshots are not rewritten.

The cleanout trailer illustration now uses phone-free v3 signage, retaining the visible towing assembly and the disclosure that it is digitally edited. Public page source references and hashed responsive-image manifest point to v3. Local public build and SEO verification pass: 23 pages and 673 local links. This evidence does not assert that these pending branch changes are live.

## Inventory foundation

`inventory-custody.ts` defines bounded individual asset/consumable identities, company item labels distinct from retail GTINs, authorized custody/location/job scopes, exact revision/time checks, recorded costs, physical handoff/count reasons, immutable before/after event proposals and formula-safe CSV output. Unknown costs remain unknown. A product barcode never supplies a purchase price or updates an invoice. Tests exercise stale/cross-company moves, another technician’s custody, quantity shortages, unknown locations/jobs and malicious scanner text.

This is a tested domain foundation, not a connected inventory screen or a live stock ledger. The next adapter must atomically persist item/event/actor-bound idempotency in canonical SQL, obtain current permissions rather than browser claims, then connect owner/technician screens, private receipt provenance and physical scanner/device validation. No public feature claim or inactive inventory button is introduced.

Production branch advanced during this review with the owner’s LLC/phone correction commits through b4c373302fbff615efc53fa342a0215be2595cc3. Those changes were integrated rather than replaced: legal policy notices, LLC email identity, company-settings example and the new stale-phone regression remain present. Focused identity/email/SEO checks pass after conflict resolution. Final CI must test the integrated head.

Native PostgreSQL review caught a deferred ledger-trigger issue that rollback-only tests did not expose: the scoped technician could not read ledger rows during the invoker trigger at commit. The trigger now validates internally under its owner, with locked search path and no client EXECUTE grants. Technician ledger RLS remains unchanged. A synthetic regression forces the deferred constraint while still acting as Technician and asserts ledger reads return zero rows. Final native commit/race CI must pass before applying this migration.

## Verified migration and CI checkpoint — November 2, 2026

Candidate f49734a435cc8b503e86dc9300792aeaefe5d5b7 passed both jobs in [release run 41379115569](https://github.com/edhemmer/YNSG/actions/runs/41379115569): 1,112 application tests, native PostgreSQL lifecycle/races/restore, 23-page SEO build, optimized CRM build, Chromium/WebKit auth/customer flows, 378 public-layout checks, 312 mobile drawer checks, 246 workspace checks, 40 careers/labor checks, 28 team/field checks, 112 field-journey checks, existing network/email/customer-insight flows and native types/lint/SDK/iOS JavaScript bundle. Synthetic tests do not assert actual email delivery or physical-device acceptance.

The four tested migrations were applied to the existing production project and verified by name/version: private_careers 20261102124426; per_person_labor 20261102124439; team_and_lead_assignments 20261102124451; assigned_field_closeout 20261102124506. The observed register now has 91 source mappings and seven retained historical Supabase-only entries. New private tables have RLS and no direct anonymous/authenticated SELECT grants. The internal ledger trigger has no client EXECUTE grant; canonical staff RPCs retain explicit role/assignment checks. No real applicant, technician, job, invoice or payment was manufactured for verification.

Security advisors were reviewed after DDL. Default-deny private career tables intentionally have no client policies ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)); exposed SECURITY DEFINER command notices are reviewed as explicit, locked-search-path, scoped command boundaries ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). The pre-existing pg_net extension location and disabled leaked-password protection remain recorded security acceptance items; no paid upgrade or weakening was performed ([extension guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). This is not an independent human security sign-off.

Google Business Profile’s saved business information was inspected and already shows 815-680-1775. Some Google search snippets still show retired cached contact text; a source correction cannot guarantee when Google recrawls it.

The migration-register/evidence update still requires final exact-head CI and the intended production merge/deployment/live smoke checks.

## Production release closure

PR #233 merged tested head d7f68877854f8b2bb32aab6a89f3d763b1baf958 as f2ebb09920ca2795a546dd7b3ef3e7ae182e54b3. The trees match (92b86a4d16ddb5c22774f85e45968834a8d02117). Both final CI jobs passed in https://github.com/edhemmer/YNSG/actions/runs/41447437480. Public deployment dpl_2DbaYhMBrcmz5mvUX6LvvAHCAsR3 and app deployment dpl_4SSKzdB8tqDFtg5oKaxdumwyZGzK are READY at that SHA with the intended .com/.app aliases. Live read-only HTTP checks pass on 23 public pages: new phone/LLC identity, hashed v3 trailer bytes, phone-free print SVG, careers public status, noindex application host and six private API 401/no-store boundaries; /api/health returns 200. The actual owner/provider/device/human/legal gates are not closed by this release. A subsequent owner request adds one-click Google reconnect in a separate tested change.

Live Chromium checks also pass at 390px and 1366px: nine service images/details, intact trailer frame, related-service suggestions and three selected cleanout/door/smart-lock jobs continuing directly to request step two, with edit-jobs and optional-time paths intact. Browser errors: zero; production writes: zero.
