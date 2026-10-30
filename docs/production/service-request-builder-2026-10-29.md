# Service request builder refinement — October 29, 2026

User requested a more current, polished flow after reviewing the photographic service release. This enhances that same gallery: exact tasks can be added from cards or the shared catalog, reviewed and removed before continuing. The mobile Continue control stays reachable after selection. Generic categories reveal tasks without inventing consent. The original links/category form remain functional if JavaScript is unavailable.

The request URL carries only canonical service/task choices. Booking validates every choice, merges it with an unfinished draft, and discards new choices when recovering an uncertain submission. Required contacts, optional timing, account choice, pricing and owner confirmation remain unchanged. No new API, database migration, paid provider or library.

Design basis: Jobber service-based online booking (https://help.getjobber.com/en/articles/online-booking/) and NN/g structure, transparency and progressive disclosure guidance (https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/). This is a design judgment, not a claim of superior measured conversion or state-of-the-art certification.

Acceptance: focused tests cover mixed-job selection/removal, bounded choices, malformed URL choices, draft merging and immutable pending recovery. Browser acceptance must cover card selection → exact booking jobs → combined review at phone/desktop and enlarged text, keyboard reachability, and no external writes. Required Linux release/PostgreSQL/browser checks and deployed SHA verification precede publication. Physical-device/customer usability acceptance remains open under WEB-02.
