# Job workspace rebuild — 2 November 2026

Scope: the field application on .app. The public website design is frozen; previously authorized farm quote-only copy and expanded-area SEO corrections remain in the pending release. This document records implementation and acceptance cases, not whole-product certification.

## Connected journeys

- Requests is a searchable queue. Opening a customer goes to the same job record used by Today, Schedule, Jobs, customer history, notification links and invoice return links. Desktop retains a neighboring request queue; mobile retains an explicit return destination.
- Plan contains original customer instructions, appointment, proposed scope and price. An estimate can be prepared before or after scheduling. Schedule confirmation still uses current resources, travel, capacity, configuration and exact revisions.
- Customer agreement is one explicit action naming the actual agreement channel, with a custom note available. It never follows automatically from confirming an appointment. Changed versions and uncertain outcomes retain their original approval attempt.
- Work contains the server-backed visit clock, pause/resume and Finish work. Finish pauses the canonical timer and waits for the saved paused revision before opening Invoice. Individual task timing is optional. Notes survive unrelated timer actions.
- Invoice carries the saved scope forward, accepts unambiguous hours:minutes, proposes the first person's recorded timer duration, and calculates cents using existing crew terms. Actual work and final charges remain editable. Extra people never inherit invented time. Billing adjustments are available without dominating the initial screen.
- Completing a visit, issuing its invoice, emailing it and recording money actually received are distinct business actions. Redundant review checkboxes are removed from this connected view; the action button records the same deliberate review. Tax, price caps, actor permissions, exact revisions and immutable issued snapshots remain enforced.
- An interrupted invoice issuance freezes its serialized command and charges. Recovery replays that exact command and verifies invoice ID and total before acknowledging success. A malformed or wrong-total response remains unconfirmed.
- Details retains assignment, service preparation/safety notes, files and history. Prepared suggestions switch to the correct real panel rather than scrolling to hidden forms.
- Settings retains one current Google connection action, a direct Taxes & invoice setup link, and collapsed preferences. The service-setup deep-link intent survives URL normalization.

## Design system

The app uses a shared system font, restrained weights, neutral surfaces, consistent controls and readable secondary text in light and dark modes. Persistent mobile shortcuts are Today, Requests, Schedule, Jobs and More. Status always has a text label; color does not carry the meaning alone. Keyboard-operable tabs keep local drafts mounted. Protected records are cleared on identity, company or permission loss; ordinary refreshes preserve the live record.

The standalone customer invoice has a shared professional layout, clear recipient, itemized work, totals, received amounts and balance. Issued data, tax, receipts and PDF arithmetic remain authoritative.

## Research rationale

Official product workflows reviewed: [Jobber jobs and visits](https://help.getjobber.com/en/articles/jobs-in-the-jobber-app/), [Jobber mobile invoicing](https://help.getjobber.com/en/articles/invoices-in-the-jobber-app/), [Housecall Pro job creation](https://help.housecallpro.com/en/articles/3181752-how-to-create-a-job), [Housecall Pro payments](https://help.housecallpro.com/en/articles/2785726-take-payments), and [FieldPulse job management](https://www.fieldpulse.com/features/job-management/). These support job-centered navigation, carrying job details into invoices and field actions attached to the work record. They do not establish that YNSG is objectively superior or that provider/device acceptance has passed.

## Clock contract and database boundary

GET /api/job-clock accepts only organization and job UUIDs. It verifies authenticated access and the returned organization, job and actor. The new field_job_clock RPC uses the same current owner/assigned-technician access helper as field work and returns saved revision/status, completed seconds, optional open interval and server check time. It creates no work sessions. UI elapsed display uses monotonic time between server reads and fails visibly on stale/malformed/unavailable reads. Client clock display never becomes an invoice or financial authority.

## Acceptance evidence and remaining checks

Synthetic Chromium owner lifecycle: 56 checks across 320/390/768/1366 pixels and both themes, including 200% text, partial cash, Zelle and saved document. Technician regression: 28 checks including an adjusted third person's rate and lost payment response recovery. Current final candidate must rerun these, full-shell navigation, all release tests, native PostgreSQL CI and optimized builds. No customer records or real work/funds are used for testing.

Before production: exact-head CI, applied clock migration verified by name, reviewed merge tree, both READY deployment SHAs/aliases and live read-only smoke. Actual lawn hourly/cleanout approval settings remain separately unverified; previous owner save reports were not database evidence. Tax/provider/device/business and independent human gates remain open. No paid AI provider is activated.

Clock migration accepted by native PostgreSQL CI at e389f72 and applied to the connected database as field_job_clock, history version 20261103001828. Source filename now uses the tool-generated applied history timestamp. The installed local CLI shim lacked its companion binary; MCP applied the reviewed DDL. Live metadata verifies stable execution, locked search path, authenticated-only API grant and rejection without a signed-in actor. No live work or customer data was created. The existing advisor warnings remain tracked: authenticated SECURITY DEFINER RPCs require intentional authorization review; this clock calls the current field_job_access helper before reading. Existing pg_net placement and leaked-password configuration are not silently accepted as resolved. See the Supabase [function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Full new-head CI is required after this evidence and invoice-layout refinement.
