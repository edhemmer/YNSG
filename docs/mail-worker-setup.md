# CRM mail dispatcher setup — October 2, 2026

This implementation does not change the current public website email path. Required production gates remain in the production checklist.

| Setting | Purpose | Current activation |
|---|---|---|
| `APP_ORIGIN` | Exact HTTPS CRM origin for protected actions and customer fragment links | Existing CRM preview origin |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Existing authenticated and narrow trusted server commands | Existing branch-scoped preview setup; Production scope requires verification |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` | Existing Google OAuth/encrypted refresh tokens; purpose-separated customer-link key | Existing configuration; never rotate without token/link migration |
| `GOOGLE_GMAIL_DELIVERY_ENABLED=true` | Global sending switch | Remains disabled until live receipt and workflow checks |
| `GOOGLE_WORKER_SECRET` | At least 32 random characters, bearer authorization for POST `/api/notifications/worker` | Required for a configured external recurring trigger |
| `CRON_SECRET` | At least 32 random characters, bearer authorization for GET `/api/notifications/worker` | Only when an approved hosting cron is configured |

Do not put secrets in public variables, query strings, committed files or customer links. Both worker methods reject unauthenticated calls. The worker takes no client-selected company and claims at most one eligible company and five notices per invocation, with an exclusive 90-second company lease and per-message leases. Expired sending attempts become Needs Reconciliation; they are not automatically resent. Token refresh preserves the owner's receipt authorization, while changed Google identity, test or published configuration requires review.

Owner setup: sign in, complete MFA, publish reviewed company details, connect Google, choose its owned calendar, send the Gmail test, verify receipt, then authorize CRM email delivery in Google Settings. Company authorization is distinct from the global sending switch and recurring worker. A provider Accepted status alone is not proof of receipt.

The recurring trigger must be configured and its timing/recovery tested. A reminder intent is due exactly 48 elapsed hours before customer arrival; provider acceptance occurs when the worker runs. Monitor queue lateness rather than claiming exact delivery time. Appointments booked within 48 hours use their immediate confirmation actions. Obsolete/canceled/replaced/past-visit notices are suppressed before claiming and again before sending. Customer attendance confirmation never cancels an unanswered appointment or accepts commercial scope.

No hosting-plan upgrade or paid scheduler is authorized by this setup document. Select an eligible commercial host/trigger after checking the actual plan. Neither cron nor customer delivery has been activated in this change. Invoice/payment/review automation remains a separate unfinished workflow.
