# App language and notification review — October 4, 2026

## Acceptance checklist
- [x] Owner screens use clear business language; CRM and worker jargon are kept out of normal actions.
- [x] Calendar copy distinguishes displayed visits from booking availability and preserves the personal-calendar limitation.
- [x] Blocking time remains private and does not imply that removing a block guarantees availability.
- [x] Customer and owner messages use a shared navy, green, gold and white email layout, readable type, grouped information and clear actions.
- [x] Every message has a plain-text alternative; all customer-entered content is escaped in HTML.
- [x] Confirmation, reminder, decline, reschedule, invoice and paid receipt retain their actual workflow meaning.
- [x] Reminder asks customers to email immediately when rescheduling; links do not change bookings merely by opening them.
- [x] All selected services, local appointment dates, contact details and exact approved invoice amounts remain intact.
- [x] No private notes, waiver reasons, internal billing increments, error codes, promises or invented contact information enter customer messages.
- [x] Review requests remain optional; paid receipts require verified full payment.
- [x] No authentication, scheduling, delivery permission, database or website-intake cutover behavior changes.
- [x] Existing branding and official logo remain intact; no stock/generated photos or new dependencies.
- [x] Production build and 101 automated tests pass.
- [ ] Deployment verification pending until this commit is ready.
- [ ] Real Gmail and iPhone Mail acceptance pending; static previews cannot establish email-client rendering.

Scope: app-rendered screens and outgoing transactional templates in this repository. Supabase-hosted authentication email templates and real inbox rendering cannot be proofed through repository source alone.

## Review findings and corrections
- Removed CRM from the calendar, normal owner actions, Google settings, request emails and connection test.
- Replaced technical delivery and quote wording with everyday business language while retaining setup and delivery limitations.
- Shared email layout: navy heading, gold divider, green action buttons, white content area, high-contrast 17 px body copy, 600 px fluid width, inline fallback styles, dark-mode overrides and plain-text alternatives.
- Reviewed all seven appointment types plus owner request, request decline, invoice, payment thank-you and Gmail connection test. HTML now travels through the dispatcher for appointment and decline messages, which previously omitted it.
- Owner reply actions address the customer; customer email replies address the business notification contact.
- Preserved every selected service, appointment approval semantics, local dates, reschedule safeguards, approved invoice values and optional review rules. No photographs or logo replacement.
- Automated coverage includes every appointment template, cross-category services, HTML escaping, unsafe-link rejection, invoice totals, private-record exclusion, paid-receipt preconditions and MIME alternatives.
- Reviewed changed components against React guidance: copy-only UI changes retain state, callbacks, disabled controls, permission checks, keyboard controls and existing live regions. No dependencies added.
- Browser preview of local synthetic email files was blocked by the cloud browser network policy. No live message was sent and no customer/owner session was impersonated.
- Provider-managed Supabase authentication templates, weather notifications not implemented here, and real inbox rendering are outside this source-template verification. Do not claim those passed.
