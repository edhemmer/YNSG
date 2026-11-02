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
