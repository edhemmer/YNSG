# Owner entry protection

The guided quote, conversation notes and actual-work/invoice forms report unsaved entries to a workspace-local registry. Switching workspace sections, jobs or businesses, signing out, closing the full request and changing guided steps asks before discarding these edits. Browser unloading requests the browser's native warning; supported same-origin page links are guarded. Unknown work-completion/payment results retain their stricter existing mutation locks rather than being treated as ordinary unsaved drafts.

No drafts, contacts, taxes or authentication tokens are copied to localStorage, the native bridge, analytics or a new external service. This is in-memory entry protection, not offline persistence or a backup. Force-quitting a phone browser, OS memory eviction and some iOS navigation paths can bypass browser unload warnings; device testing and a separately designed bounded encrypted draft store remain open.

If a job revision changes elsewhere while the invoice/work form is dirty, keep the entered lines visible and block saving/issuing. Explicit reload asks before discarding. Successful same-owner draft saves and atomic completion use the returned revision and do not create a false conflict. A stale draft cannot silently overwrite the newly saved revision.

Saving actual work does not save an invoice's tax agreement. Local tax-rule selection and review evidence stay in the form through the owner's returned work-save revision and remain marked unsaved until invoice review/issuance actually records them. No tax approval is inferred.

Coverage is deliberately specific to guided quotes, conversation notes and work/invoice forms. Customer/contact/property CRUD, every settings/payment form, cross-device merging and cold-start restoration are not advertised as covered by this increment. Native signing, notifications, Apple review and device acceptance are still separately gated.
