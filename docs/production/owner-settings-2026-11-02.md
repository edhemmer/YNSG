# Owner Settings and brand tagline — 2 November 2026

Advances WEB-06 (connection recovery) and WEB-10 (owner usability); this maintenance release does not certify the full product or native distribution.

Settings now starts with three operational statuses and one Google Calendar/Gmail action. Four named disclosures hold business details/rates/hours, customer email/calendar preferences, phone alerts, and security/records. The duplicate Google notice is removed on Settings itself. Password and synthetic practice links move into Security & records; the redundant Business preferences card and marketing explanation are removed. Existing controls, company permissions, review-before-publish, recovery and unsaved-entry protection remain in place. Collapsing a section retains its mounted draft.

A connected account without a selected calendar offers Choose business calendar. A saved calendar uses the existing direct reconnect command. Advanced mail approval/test, explicit pause, calendar choice/subscription and disconnect remain deliberate actions. Maps/key/billing diagnostics are omitted from the compact owner card. Read failures remain visible and cannot be reported as a confirmed connection or missing business setup. No mail, event, approval, charge or customer record is created by this redesign.

The homepage tagline crops the script and gold stroke from the approved logo artwork using an accessible SVG viewport. It reuses the logo image; it does not substitute a different script font or introduce another third-party request. Phone/desktop inspection confirmed the crop and no horizontal overflow.

Validation: lint, root/web TypeScript, generated API contract check, completion-register integrity, optimized Next build, 23-page SEO/link/schema checks, and 15 targeted reconnect/settings/recovery unit tests passed locally. The workspace browser suite was extended with phone/desktop light/dark Settings, single Google action, four closed sections, retained collapsed draft, navigation cancellation, reachable email controls, text contrast and 200% text cases. The exact final candidate requires both release CI jobs before merge and both production SHA/alias checks and read-only smoke afterward. No database migration is introduced.

## Prior reconnect release and provider configuration

PR #234 was tested at 956957f5bf7ef0924a1c6e01dc5d648c51e1daaf; both jobs in https://github.com/edhemmer/YNSG/actions/runs/41453833981 passed. The tested tree was merged as 0c3944a0c0f530766793ac330e0f11741bfece9b. Both Vercel production projects reported READY at that merge. The reconnect migration was previously applied and verified by name; no new paid service or service scope was enabled.

The owner explicitly approved adding https://yourneighborhoodserviceguy.app/api/google/callback to the existing YNSG CRM Web OAuth client's authorized redirect URIs. The production callback was saved and reloaded to verify persistence alongside the existing preview URI. This corrects the reported redirect_uri_mismatch configuration. It does not constitute actual owner OAuth consent or successful Gmail/Calendar delivery. Actual account consent and provider/device acceptance remain separate evidence; reconnect retains paused controls rather than enabling sending silently.
