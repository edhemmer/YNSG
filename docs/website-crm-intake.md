# Website-to-business intake — October 5, 2026

Internal implementation and verification record. This file is not included in the website output.

## Current transport

The public website now saves requests through the protected business app's `/api/website-request` endpoint. It uses the existing server-only `CRM_AVAILABILITY_URL` and `CRM_AVAILABILITY_BYPASS_SECRET`; no database service-role credential is copied to the public website. The business app binds the company using `PUBLIC_SCHEDULING_ORGANIZATION_ID` and calls the canonical `submit_service_request` RPC. The previous explicit `CRM_INTAKE_ENABLED=true` direct-database transport remains supported for configured installations. The default no longer falls back to email-only success.

A signed server envelope includes the exact body and a timestamp valid for 60 seconds. A privacy-preserving network-address digest identifies the quota bucket. Secrets and raw network addresses are not returned to the browser or stored in request records. CRM errors produce a friendly retry message and preserve the form. The same request key and same payload produce the same durable request through the existing command receipt.

## Silent abuse controls

- Hidden honeypot is outside keyboard navigation and the accessibility tree; a filled value is discarded before provider work.
- Cross-site browser submissions are rejected. This is an additional check, not proof of humanity.
- Server-side input allowlists, size limits, required contact fields and current availability recheck remain enforced.
- Calendar reads: 60 per minute per keyed network-address digest.
- Submissions: 20 per hour per network-address digest and 5 per hour per email digest; the canonical intake RPC also enforces its existing limit of 5 committed requests per hour per network-address digest.
- Identical safe retries within 24 hours do not consume another website quota allowance. Database command receipts prevent duplicates beyond that short quota retry window.
- The private quota tables deny anonymous/customer access. Only the server role can execute the quota function. Old quota rows are pruned on subsequent activity after 25 hours.
- No CAPTCHA, minimum completion speed, customer challenge or additional form step.

These measures reduce ordinary automated abuse. They do not guarantee that distributed bots or compromised server credentials can never send requests.

## Notifications

A durable request insert atomically creates both an owner notification intent and a customer receipt intent. The background worker uses the owner's connected, approved Google sender and the current company email branding. The owner email links to the saved request. The receipt includes all categories/items, requested timing, and a clear statement that the owner will call to confirm details and date. It does not claim that an appointment is confirmed. Declined/canceled requests or requests already reserved suppress stale pending receipts. Provider-unknown outcomes remain subject to reconciliation rather than automatic duplicate sending.

## Verification

- Website: 13 tests passed; syntax checks and nine-page build passed.
- Business app: 123 tests passed before final timing polish; production build passed after clearing a corrupt local generated build cache. Timing polish has focused email tests and type checks.
- Hosted rollback test: one request queues exactly `request.owner_notification` and `request.customer_receipt`; both services persist; receipt-current checks and worker allowlists include the new kind.
- Quota rollback tests: 61st read within a minute denied; 6th request per email within an hour denied; identical retry permitted.
- Live public form: October 5, 2026, 12:49 UTC. A clearly marked test addressed only to the owner's verified business email saved request `51f8d1e1-b337-472c-8cc8-31a40f034a4a`, with two service items and requested October 6 at 9 AM local time. Status remained `submitted`; zero appointment records were created.
- Both live outbox messages reached `accepted` through the scheduled Google worker. This means Google accepted the sends, not that inbox placement was independently observed.
- Live public calendar and request endpoints returned HTTP 200; protected GET requests to the new POST-only app endpoints returned 405.
- Database advisors report pre-existing pg_net schema/password-protection findings and an owner-sign-in deny-by-default table notice; no new quota-table finding was returned.

## Still separate

Guest slot selection does not create a temporary reservation. Confirmed capacity is governed by owner scheduling approval; simultaneous guests can still request the same preference. Recurring intake retains weekly intent; this change does not reserve a year of appointments. Actual owner SMS alerts are not enabled: they need a configured SMS provider, a verified owner destination and applicable sender registration/cost approval. Owner email is active now. No SMS account, subscription or paid sender was created.
