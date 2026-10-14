# Owner mobile product controls

The active owner journey is Requests/Calendar → one guided record → Confirm → Complete → Invoice → Close out. Browser and native workspace use the same canonical database authority. Data editing is permission-specific; original submissions and issued invoices remain saved evidence.

## Controls from the October 14 reference image

| Control | Concrete implementation | Verification |
|---|---|---|
| Specification first | `docs/engineering-spec.md`, canonical SQL migrations and generated `contracts/owner-api.openapi.json`; strict executable mutation schemas. | `npm run contracts:check` fails on contract drift; unknown mutation fields fail validation. JSON schema describes wire input; SQL and documented refinements enforce business meaning. |
| Repository guardrails | Root `AGENTS.md`, native `AGENTS.md`, agent authority contract and current governance. | PR review against actual scope; rules are engineering guidance, while API/SQL checks enforce permissions. |
| Isolated validation | Transaction-scoped synthetic database fixtures, disposable PostgreSQL 17.11, race/retry/restore checks. | Real customer data, production credentials and APNs calls are excluded. Public previews are isolated code deployments; they are not falsely advertised as a separate staging database. |
| Automated layers | Required browser/contract/security tests, native types/lint/SDK/bundle and PostgreSQL CI. Separate native distribution gate fails on native audit or incomplete evidence. | Run results belong to an exact commit; deployment SHA and migration names are verified. No advisories are hidden or waived. |
| Human oversight | Eight-gate evidence register includes independent engineer review of auth, tenant boundaries, financial changes and push privacy. | Reviewer, exact commit, findings and resolutions must be retained in a reviewable evidence link. AI review cannot certify this gate. |

## Phone alerts

A native, deliberately confirmed permission request obtains the signed app's APNs token. A tightly bounded bridge carries only appearance and device registration; no login token, financial mutation, file URL, arbitrary command or external navigation. The signed-in same-origin CRM registers the user's own organization/device/session through a guarded RPC. Device tokens are encrypted with a dedicated server key and omitted from device metadata, logs and lock-screen text.

New website requests enqueue one intent per connected device in the original database transaction. Yearly repeat occurrences do not create a burst of new-request alerts. A bounded worker queues one reminder for each confirmed appointment revision within 30 minutes before reserved work starts (including supplier pickup before customer arrival). It rechecks device consent, current user/session/membership, business-local quiet hours, exact appointment revision/status and future reserved start before sending. Rescheduled/canceled/expired reminders are skipped. Sending crashes/timeouts become unknown; they are never blindly sent again. APNs acceptance remains distinct from an alert visible on a phone. Invalid tokens are disabled. Stopping a device's alerts erases its encrypted token; its nonsecret audit/history remains.

Activation is off by default. Required server settings: `OWNER_PUSH_ENABLED=true` only after reviewed setup, APNs team/key/private key/bundle/environment, a dedicated 32-byte `PUSH_TOKEN_ENCRYPTION_KEY`, and a private `OWNER_PUSH_WORKER_SECRET` of at least 32 characters. A trusted scheduler must call `/api/mobile-notifications/worker` frequently enough for appointment reminders, without publishing its secret. Native `EXPO_PUBLIC_APNS_ENVIRONMENT` must match the signed provisioning environment and server. No Apple credentials, paid builds, real device registrations or new customer messages were created by engineering tests.

## Editing and entry coverage

| Data/workflow | Current phone/iPad workspace behavior | Boundary / remaining work |
|---|---|---|
| Requests | Open, review, annotate; read separate date/arrival/work-window cards. | Original intake is preserved; corrections are recorded notes rather than overwriting consent evidence. |
| Appointment | Canonical confirm, reschedule, cancellation, weekly preview/book/stop and personal blocks. | Server rechecks conflicts/travel/resources; native devices must complete the actual workflow acceptance test. |
| Quotes/agreement | Edit unaccepted scope/time/rate eligibility; record actual agreement. | Accepted versions require a change order. No manufactured acceptance. |
| Actual work | Start/pause/resume; record descriptions, minutes and charges; reviewed atomic completion stops the timer. | Unknown result freezes edits and checks the same command. |
| Invoice | Save/review charges/tax, issue, adjust supported administration, open PDF, request email. | Issued financial snapshots are immutable. Native authenticated PDF sharing still needs implementation/device proof. |
| Funds/expenses | Confirm actual cash/Zelle, split receipts; record/reverse documented expenses and review reports. | No inferred funds or Stripe work in this release. |
| Notes/company settings | Existing owner-permitted notes and business/calendar/tax/equipment settings remain in the mobile workspace. | Editable fields are those actually supported by guarded commands. Full customer/contact/property CRUD and additional correction/reversal flows need explicit implementations; they are not advertised as complete. |
| Device preferences | Native Automatic/Light/Dark, large system text and optional phone alerts with separate categories, sound, quiet hours and stop controls. | Signed devices and Apple provider delivery remain unverified. |

## Apple release gates

The app is not Apple-approved or declared App Store compliant. Current work adds native preferences/notifications and preserves the CRM's operational utility; minimum-functionality review still requires a real native release assessment. Current Apple guidelines require optional/privacy-safe notifications, accessible in-app privacy information, and account deletion where account creation is supported. Account deletion must distinguish login/personal data from legally retained business records; the final deletion/retention workflow is not implemented or invented here.

Before distribution: resolve high native toolchain advisories; Apple enrollment/bundle/signing/APNs setup; native authentication handoff and PDF sharing; app icon/splash/privacy manifests and accurate disclosures; device accessibility and unreliable-network acceptance; independent human security review; TestFlight and App Review. The machine-readable evidence register remains pending and blocks native distribution. No paid AI model is activated; proposals cannot override canonical approval/data checks.

Official requirements checked October 14, 2026: https://developer.apple.com/app-store/review/guidelines/ ; https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ ; https://docs.expo.dev/versions/v57.0.0/ .
