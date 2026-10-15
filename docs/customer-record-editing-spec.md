# Owner customer records

Implement current customer profile, contacts and service addresses in the mobile owner Customers workspace. Explicit owner/admin live-session permission is required by narrow canonical commands. Lists page 20 customers, requests and history; a detail refuses more than 100 contacts/addresses instead of hiding records. No direct table writes or account-access changes.

Commands: create_customer, update_customer, save_contact, save_property, set_archived. Executable strict contracts are customer-record-contract.ts. Every existing-customer command requires its exact parent revision; existing child edits also require its exact revision. One parent row lock serializes all profile/child edits. Same-input, same-actor/session receipts replay before stale checks; changed retries fail. Unknown results freeze editing/navigation and replay the exact saved command, never generate another key. Definite conflicts keep the draft for review and require an explicit reload/discard before overwriting.

History retains immutable private before/after snapshots, actor/session, time and optional owner note. Public audit contains identifiers/action only, no contacts. Original requests, accepted quote versions, issued invoices, recipient snapshots, portal identities and queued messages are unchanged. Current contact email is not portal access and never merges households. Archiving hides a relationship from the active directory, retains portal/history, and is blocked by unresolved requests, active work, future reservations or unpaid invoices. Restoring is explicit. Historical records are not deleted.

Editing an existing service address is blocked if it is referenced by a future held/proposed/confirmed visit or unfinished job. Add a new address without moving an existing booking; use appointment review for actual visit corrections. Census matching is optional and advisory, uses only entered address fields on a deliberate action, and never proves a delivery point or tax boundary. Drafts remain in component memory; browser unload warns but is not offline durable synchronization.

Acceptance: create/edit contact and address, exact replay, stale revisions, races, child/customer/tenant mismatch, revoked identity/membership, customer impersonation, direct-write denial, immutable history, bound enforcement, original/snapshot retention, archive guards and explicit restore. Synthetic SQL fixtures run on both PGlite and disposable native PostgreSQL. Rendered UI tests prove phone-friendly entry, retry locks, conflict retention, navigation and reload behavior. Physical-device acceptance remains separately evidenced.


## Connected mobile workflow and release checks — 14 October 2026

| Requirement | Pass condition | Current engineering evidence |
| --- | --- | --- |
| Current customer information | Owner opens a customer, edits name/contact/address, searches and pages without changing portal identity. | Rendered editor tests, strict API tests and isolated database assertions. |
| Existing customer on a new request | Owner explicitly chooses and verifies the customer during quote preparation; canonical PublishQuote rejects mismatches. | Rendered customer picker test and existing commercial command constraints. |
| History and money | Current corrections retain original requests, accepted quotes, issued invoice/recipient snapshots, payments and queued mail. | Snapshot hash assertions in commercial SQL; immutable private history fixture. |
| Interrupted saves | Exact saved command/key is replayed; fields and navigation lock until known. | Rendered lost-response/double-submit test and API unknown-result tests. |
| Conflicting edits | Exact parent and child revisions, bounded integers and one parent row lock; stale updates retain the draft. | Synthetic SQL and rendered conflict/reload tests; independent PostgreSQL race required in CI. |
| Directory completeness | Bounded pages, overflow flags, archive/restore and refusal to silently truncate more than 100 contacts/addresses. | Database paging, archive and limit fixtures. |
| Clear booking state | No saved-time summary before a deliberate time hold; recovery text names the available action. | Calendar state tests. |
| Clear owner attention | Confirmed visits with unfinished agreements explain the actual next action and open Continue workflow. | Rendered attention-card test. |
| Mobile visual acceptance | Phone/iPad keyboard, large text, VoiceOver, touch, dark mode and complete service lifecycle. | Pending physical-device/user acceptance. |
| Independent release evidence | Required CI on exact head, hosted migration by name, deployed SHA and live read-only walkthrough. | Required before describing these changes as live. |

Preserve the official logo, navy/forest/gold/cream palette, required public request name/phone/email/address, explicit customer agreements, actual work/funds, immutable financial history, account-optional intake and existing pricing/service restrictions. Do not restore oversized public navigation, hidden-only public menu access, required MFA, paid address validation, activated paid AI, fabricated approvals or Stripe scope. No visual award, Apple approval, full accessibility certification or universal click correctness is claimed by test/build success.
