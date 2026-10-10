# Production email and invoice verification — October 10, 2026

Owner authorization: finish production workflows, email all owner/customer template examples to the owner, and show a sample invoice online and in customer format.

Live owner password login succeeded through secure browser authentication. The owner UI created sample run c58016da-6cc6-450e-b161-36ee80c0cc9f for organization a933d657-14d3-46b6-85e6-21d973e4ed97. Approved recipient is edhemmer@gmail.com, matching the account and notification settings. The record uses diagnostic.sample_suite and does not create a financial invoice, payment, job or appointment.

Sample invoice: $120 labor for two hours of furniture assembly; a documented courtesy door adjustment has no charge; example total and balance are $120, with zero payments. Sample banner and PDF metadata explicitly say NOT A BILL. Online display uses the same renderer as the actual customer invoice document. Customer sign-in and invoice access permissions have not been tested with this sample.

Fifteen business template examples cover owner/customer intake, approval, booking confirmations, owner/customer reminders, time/service/request declines, reschedule request, running late, invoice/PDF, payment thank-you/review and Gmail connection test. Every example is marked SAMPLE and directed to the approved owner inbox. Example review/action links point to the sample screen. Authentication emails remain a separate Supabase delivery path.

The first live sample send failed in MIME validation before any provider call or send record. Corrected identifiers and attachment naming now pass exact production formatting tests. Durable background sample delivery has been implemented with existing enabled-company leases, a membership/current-recipient check, compare-and-set before send, saved provider results and no automatic resend of failed or uncertain outcomes. SQL selector migration was applied and verified. The diagnostic sender is isolated from the actual customer-message adapter.

Validation: 209 application tests pass, including actual sample MIME/PDF rendering, recipient rejection, revoked ownership, duplicate sends, compare-and-set race and uncertain transport outcomes. Root and web TypeScript checks, whitespace checks, all database migration/fixture suites, and optimized local webpack build pass. Database assertions verify enabled/paused diagnostic company selection and exclusion from the actual message adapter.

Production deployment limitation: Vercel returned HTTP 402, api-deployments-free-per-day, more than 100 deployments, retry after 86400 seconds. Corrected background sender source is committed on codex/crm-workflow (a6b8ec833f821a4b8d94c7737d38ba701a8c2d92 before this report). Latest ready deploy at this checkpoint is 2cf2f08c23f8a934f4592fe38e755bdb714c85be, which does not contain the complete fix. Do not call the sample email test completed. Hosted final evidence: one saved sample suite, zero sample-send records, zero real invoices.

Required owner inputs:
1. Resolve Vercel deployment quota by waiting for the daily reset or choosing an appropriate plan in team Billing. No plan or billing changes were made.
2. CRM Settings / company configuration: enter Invoice terms.
3. Confirm actual labor tax treatment. The currently implemented choice only supports reviewed non-taxable labor; do not select it without review. Taxable labor requires further invoice implementation.
4. After publishing the corrected sender, enqueue the sample set and verify all 15 provider results, PDF download, and actual inbox receipt.
5. Complete the separate real website → request → Google booking → work completion → issued invoice → actual received-payment verification. The paid email example is a rendering example, not evidence of money received.

Email/calendar cron jobs are enabled every minute and recent cron launches succeeded. This does not alone prove downstream HTTP processing or phone receipt. Payment UI records money received elsewhere; no card-checkout integration was demonstrated. Full production certification remains pending.
