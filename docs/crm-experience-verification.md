# CRM experience verification — October 8, 2026

## Delivered behavior

- Permanent business navigation and a premium navy, green and gold workspace, preserving the official YNSG logo and configured tenant branding.
- Overview with real business totals, a newest-first attention inbox, direct route/work/billing destinations and automation exceptions.
- Requests inbox: exact count, independent 20-record pages, literal-safe contact/address search, open/all/closed filters and automatic refresh only while visible.
- One request drawer: work, contact, directions, timing, customer rescheduling preferences, appointment history, private notes and linked quote/job/invoice context.
- Appointment approval starts a submitted request's required review automatically, then opens the existing verified scheduling form. Scope, travel, resource and pickup checks remain required. Current Google checks still happen on the server.
- Decline-time and decline-service use the canonical scheduling command, revision, reason and stable retry key. Requests without active appointments use the canonical request-decline command and its existing standard notice.
- Calendar month/week/day views open the same drawer. Weeks spanning months fetch both months, deduplicate records and correctly exclude expired holds from active visits. Phones show readable counts and a full selected-day list.
- Personal time blocking is collapsed under a clearly labeled control. Requests without dates have a direct inbox destination.
- Linked work retrieves relationship keys independently of display pages, preserving jobs and invoices associated with earlier quote pages.
- Role-appropriate initial navigation, business switching, dialog focus restoration, busy-state protection, inert closed phone navigation and reduced-motion support.

## Executed checks

| Check | Evidence |
|---|---|
| Unit regression suite | 156 tests passed, including new expiration/stage precedence and search grammar cases |
| Root TypeScript and syntax checks | Passed |
| CRM TypeScript / Next.js production build | Passed |
| PostgreSQL workflow regression | All empty-schema migrations and foundation/commercial/scheduling/Google/operations/review/customer/mail assertions passed in PGlite |
| Desktop browser workflow | Overview → Requests → page 2 → search → request drawer → review prerequisite → confirm → Calendar → appointment drawer → decline-time payload |
| Actual new API boundary | Next.js request-inbox route reached a synthetic Supabase HTTP server; exact count, tenant filter, search and paging were exercised |
| Actual review command boundary | Next.js commands route reached the synthetic review RPC with the expected request ID/revision/status |
| Calendar boundary week | September 30 appointment appeared in the week containing October 1 |
| Phone layout | 390px calendar, inbox and request drawer inspected; no document horizontal overflow |
| Keyboard/accessibility | Escape closes drawer, returns focus to originating request row; narrow 720px layout and reduced-motion mode verified |
| Access failures | Unsigned-in inbox access returned 401; other-business membership returned 403 |
| Browser runtime | No page errors in the final run |
| Whole-deliverable review | Changed source, exact-logo asset, checklist, rendered desktop/phone screens, role navigation, command and relationship paths reviewed |

Browser data was synthetic. Scheduling review provider responses and decline responses were simulated; this is not a claim of a live confirmation, live email receipt, provider race test, or complete feature parity with other CRM products. The existing PostgreSQL suite separately checks canonical state/outbox behavior.

## Live read-only evidence

Google account configuration includes encrypted tokens and a selected calendar. Both `ynsg-mail-worker` and `ynsg-calendar-worker` cron jobs are active. Four recent worker HTTP responses were 200 with no timeout. Live request/appointment aggregates were inspected without exposing customer details.

No live customer messages, appointments, DNS, deployment protection, billing rates, catalog permissions, paid services or provider activation were changed during verification. No database migration is needed for this redesign. Production/public website release is outside this preview update.
