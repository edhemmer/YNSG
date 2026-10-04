# Website and owner testing pass — October 4, 2026

Internal reference. Background automation is deferred at the owner's request. This is not a production release approval.

## Constraints and review

| Requirement | Result |
|---|---|
| Preserve logo, service scope, required fields and public email flow | No public source changes; website syntax and build pass |
| Retain authorization, tenant isolation, invoice approval and booking checks | No API, schema or authorization changes |
| No required 2FA, public billing-extension policy or rejected copy | None added; visible internal customer IDs removed |
| Clear controls, mobile text, keyboard focus and reduced-motion rules | Existing rules retained; action links have 48px minimum height; headings wrap |
| Accurate appointment state | Reserved says Confirmed; proposals say Awaiting approval; holds say temporarily held |
| Helpful feedback and recovery | Owner feedback above content; customer history loading/retry; expired sessions clear old records |
| Honest readiness | Automation, device, recurring booking and intake acceptance remain separate |

## Completed polish

Owner tab navigation resets record pages. Settings no longer displays record pagination. Business placeholders and customer cards avoid UUID labels. Today identifies the work area directly. Linked requests have Show all service requests. Customer login avoids duplicate current-action buttons and disables mode changes during submission. Missing appointment details prompt review instead of showing stray punctuation.

## Verification

118 existing unit tests pass with node --import tsx --test. Root/web TypeScript and Next.js production build pass. Public JavaScript syntax and nine-page static build pass. All 218 relative page links and local fragment targets resolve. This does not verify external links, real account mail, device rendering, directions or inbox delivery.

## Owner testing sequence

1. Open /owner, sign out and sign in. Open each tab and verify your business.
2. Review published Settings and Google calendar selection. Email approval is verified enabled. Automatic dispatch requires deferred trigger work.
3. In Calendar, select a day, create a test unavailable-time block, verify it and remove it. Private reasons must stay private.
4. With designated test contact details, request work from two categories on the public website. Verify receipt and all selections. Email receipt alone does not prove CRM intake.
5. If the request appears in Work, add a note, review it and test its scheduling decision. Verify conflict checks and current confirmation details before live bookings.
6. Invite a designated test customer. Verify signup/reset mail, linked history and isolation from other customers. Repeat intake currently accepts a timing preference; it does not reserve a slot.
7. Test closeout, invoice draft, no-charge work, owner approval, PDF/print and payment recording. Do not send test notifications to real customers.
8. On your phone, verify calendar days, forms, buttons, long addresses, directions and the printed daily list. Authenticated mobile and real provider acceptance remain unverified in this pass.

## Remaining completion gaps

- Background notification/calendar triggers and monitoring.
- Atomic guest holds and full recurring per-visit reservation/order workflow.
- Public-to-CRM activation, customer calendar selection and real request acceptance.
- Real customer signup/recovery/linking and full closeout/invoice acceptance.
- iOS signing/device tests, backup recovery and complete production release acceptance.
