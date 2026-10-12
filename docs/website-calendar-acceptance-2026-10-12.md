# Website calendar repair acceptance

Active request: clicking a day does nothing. Production build serves 17240302; live /api/availability returns 503. CRM runtime warning identifies calendar_and_reservations. Calendar availability must reflect actual Google busy intervals and database reservations, preserve signed server transport and quotas, and never invent slots or silently book an appointment.

Before edits:
- Pending: identify failing integration prerequisite and restore actual availability.
- Pending: expired availability refresh preserves the date click and shows fresh available times without requiring a second click.
- Pending: expired time clicks revalidate the selected slot before holding, detect conflicts and give clear feedback.
- Pending: failed checks keep unavailable slots disabled and clearly explain retry; no weakened authentication/guard/limits.
- Pending: focused browser/VM regression checks, types/build and serving Production deployment verified.
- Pending: live day selection opens times; live hold selection releases safely; no fake customer lead or paid invoice created.

Earlier invoice/email task remains active: 17240302 published primary changes, but attachment filename and invoice email summary refinements are local only; fresh sample suite and actual inbox delivery remain outstanding. Do not overwrite those changes.

Root cause verified: Google account health is reconnect_required; accessToken refresh categorizes invalid_grant as RECONNECT_REQUIRED. Stored calendar/tokens exist and database RPC/table permissions are present. Renewal requires owner Google consent; no token was invented, deleted or substituted. Google documentation notes seven-day refresh-token expiry for External apps in Testing; actual Cloud publishing status has not been inspected.

Implementation checks: 229 tests pass, including single-click expired day refresh, single-click expired slot recheck/hold, and conflict removal without any hold. Root/web types and website syntax/static build pass. Error notice moved before the calendar and clearly states that dates cannot be selected while checking fails. Owner connection UI explicitly identifies reconnect_required instead of implying that a stored Google token is usable. Live availability remains blocked by rejected Google authorization, and actual date-to-hold/provider acceptance cannot be certified until owner renews consent. No new real lead, invoice or payment was created.
