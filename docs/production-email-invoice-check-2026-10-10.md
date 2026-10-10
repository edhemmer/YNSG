# Production email and invoice verification — October 10, 2026

Owner authorization: finish production workflows, email all owner/customer template examples to the owner, and show a sample invoice online and in customer format.

Live owner password login succeeded through secure browser authentication. The owner UI created sample run c58016da-6cc6-450e-b161-36ee80c0cc9f for organization a933d657-14d3-46b6-85e6-21d973e4ed97. Approved recipient is edhemmer@gmail.com, matching the account and notification settings. The record uses diagnostic.sample_suite and does not create a financial invoice, payment, job or appointment.

Sample invoice: $120 labor for two hours of furniture assembly; a documented courtesy door adjustment has no charge; example total and balance are $120, with zero payments. Sample banner and PDF metadata explicitly say NOT A BILL. Online display uses the same renderer as the actual customer invoice document. Customer sign-in and invoice access permissions have not been tested with this sample.

Fifteen business template examples cover owner/customer intake, approval, booking confirmations, owner/customer reminders, time/service/request declines, reschedule request, running late, invoice/PDF, payment thank-you/review and Gmail connection test. Every example is marked SAMPLE and directed to the approved owner inbox. Example review/action links point to the sample screen. Authentication emails remain a separate Supabase delivery path.

The first live sample send failed in MIME validation before any provider call or send record. Corrected identifiers and attachment naming now pass exact production formatting tests. Durable background sample delivery has been implemented with existing enabled-company leases, a membership/current-recipient check, compare-and-set before send, saved provider results and no automatic resend of failed or uncertain outcomes. SQL selector migration was applied and verified. The diagnostic sender is isolated from the actual customer-message adapter.

Validation: the current 222 application tests pass, including actual sample MIME/PDF rendering, recipient rejection, revoked ownership, duplicate sends, compare-and-set race and uncertain transport outcomes. Root and web TypeScript checks, whitespace checks, all database migration/fixture suites, and optimized local webpack build pass. Database assertions verify enabled/paused diagnostic company selection and exclusion from the actual message adapter.

Live follow-up October 10: all 15 samples were queued through the signed-in owner UI and accepted by Gmail. Read-only database verification found 15 saved provider identifiers. The sample invoice PDF was downloaded through the live UI and visually reviewed; the owner and customer display contexts match. Actual inbox/phone receipt remains for the owner to confirm. The sample did not create or pay an actual financial invoice.

Production builds for source 7ae9900 completed for both projects. Website deployment dpl_B6Wk3HDF2GX16YMoaZKZ5R8ihpc9 uses the .com domains. CRM deployment dpl_2dQXUTE7WkRoiZpVU1TXU3ahGKEe uses .app; the apex alias was moved from its preview build to this Production-environment build. Money and Taxes loaded under the authenticated owner session. The former deployment quota blocker has cleared.

Required owner inputs:
1. Confirm actual receipt of the 15 sample messages and the invoice attachment in the owner inbox/phone.
2. Publish actual customer invoice terms in CRM Settings.
3. Confirm actual labor/material tax treatment and any applicable reviewed jurisdiction rules in Money → Taxes; no rate is inferred from the owner's state alone.
4. Verify the actual live Stripe merchant, signing secret and production webhook. The implementation supports card-only checkout and retrieved exact fees; environment metadata access returned HTTP403, and no real charge or bank settlement has been demonstrated.
5. Complete the separate actual website → request → Google booking → work completion → issued invoice → money received → signed provider processing → receipt/reconciliation check. A paid-message sample is a rendering example, not evidence that funds were received.

Email/calendar cron jobs are enabled every minute and recent cron launches succeeded. This does not alone prove downstream HTTP processing or phone receipt. Payment UI records money received elsewhere; no card-checkout integration was demonstrated. Full production certification remains pending.


## Production-environment follow-up

The owner selected payment due when the agreed work is completed. The attempted Settings publication failed; do not claim it saved. Under a Production-environment deployment, sample-suite loading, card checks and connection-status checks failed while ordinary owner reads still worked. Vercel refused the authorized APP_ORIGIN Production upsert with HTTP403 (additional production-variable permissions required). The exact missing or invalid variable cannot be inferred from those errors. The .app domain is branch-bound to codex/crm-workflow, so automatic preview builds can retake its alias.

The apex CRM alias was restored to the last verified working release dpl_GkDy9GW9V6k9eSRF7YHVyH4E9mPa (7ae9900). This is a Preview-environment build serving the live portal, not a claim of Production-environment acceptance. The .com website remains on its reviewed Production build. Operator actions: Vercel ynsg-repo Settings → Domains → Edit .app → connect to Production; review Production APP_ORIGIN, Supabase server/client credentials and Google worker/account settings using the secure dashboard; redeploy the reviewed source; verify the settings write, worker execution, sample suite and card check before reassigning the CRM alias. Card-only live acceptance remains separate. No real invoice or payment was created.

On the restored 7ae9900 portal, completion payment terms were published successfully as settings version 5. Tax review remains unreviewed; actual invoice issuance stays gated.

## Superseding Production cutover — October 10, 2026

CRM release 3d1cce22 is serving .app from a READY Production deployment. The .app project-domain is now connected to Production, with no branch binding. Both ynsg and ynsg-repo Production branch tracking are saved as codex/crm-workflow, with custom-domain auto assignment enabled. Only the APP_ORIGIN and SUPABASE_URL Preview branch scopes were changed to All Preview Branches to permit branch tracking; their URL values and Production entries were preserved. The former Preview fallback instructions above are historical and are superseded. The signed-in production sample suite loads and the read-only card check reports: workspace address verified, live card connection not configured. Stripe setup, actual payment and independent customer flow remain separate outstanding acceptance items.
