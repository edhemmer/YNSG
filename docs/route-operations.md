# Route operations

The owner can approve an ordinary customer-proposed appointment directly from Requests. Choosing a new time in Review creates and confirms the visit from one submission. Calendar and mail delivery remain asynchronous, separately audited states. An interrupted confirmation retains the saved proposal and retries the same command; it does not create another appointment.

Day routes are selected by date and operator. Only confirmed visits enter travel estimates and Maps navigation. Equipment lists are collapsed below visits. Supplier pickups need a verified supplier location; the application deliberately does not substitute the customer address for a pickup location.

## Live provider requirement

Set the server-only `GOOGLE_ROUTES_API_KEY` in the CRM deployment environment, with Google Routes API enabled and billing configured. Restrict the key to the Routes API. Never expose it through a NEXT_PUBLIC variable or browser code. Calendar OAuth does not configure this API.

Without the key, the route view displays an explicit unavailable estimate and offers Maps navigation. Existing owner-reviewed scheduling continues using the configured travel/setup buffer; it is **not traffic verified**. With the provider available, scheduling checks adjacent confirmed visits for each selected operator, rejects insufficient travel gaps, and includes additional travel above the configured buffer in current calendar/capacity checks. It does not move committed customer times automatically. Further appointments repeat the routing check against their current neighbors.

Estimates use actual scheduled departure times. Past driving departures are deliberately not fabricated. Twelve visits per operator per day are supported for provider estimates; larger days remain listed with an explicit estimate limit. The first visit needs an origin selected in Maps. Nearby-stop warnings suggest reviewing an A→B→C detour, not a claim of globally optimal routing or guaranteed fuel savings. Refresh before departure; forecasts can change.

## Delay notices

Running late → choose 5–60 minutes → Send customer update. The server resolves the recipient from the tenant's appointment order, verifies owner/admin permission, current revision, today’s active visit, and enabled verified Gmail delivery. It creates an outbox intent and an audit event. Identical retries reuse the receipt, and separate requests have a five-minute cooldown. Changed appointments, elapsed ETAs and notices older than thirty minutes are suppressed before sending. Delivery is tracked by the existing worker and Activity & messages. Queued is not delivered, and email does not establish SMS or push delivery.

## Release checks

Local unit, transport/provider-mock and PostgreSQL migration tests verify deterministic logic and permissions. Live authenticated scheduling, a real Routes API response, actual customer email delivery, and request-to-paid execution require separate production evidence. These checks must pass before calling the complete product production certified.
