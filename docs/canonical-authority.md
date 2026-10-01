# Canonical authority

| Fact | Writer / authoritative record | Version and evidence | Projection / conflict handling |
|---|---|---|---|
| Identity | Supabase Auth | verified identity, live session and membership/delegation | UI role never authorizes; recheck revocation |
| Customer/property | permitted customer/staff command | revision, source submission, audit | search/autofill never auto-merge |
| Catalog/configuration | permitted publish command | immutable published configuration, policy and pricebook versions | organization+version cache keys; rollback publishes an explicit revision |
| Approved scope | exact quote/change acceptance | immutable lines, policies, actor, time | job brief and PDF are projections; revision invalidates old acceptance |
| Capacity | transactional reservations | revision, external busy/travel snapshot and override evidence | Calendar is a projection; external moves re-enter validation |
| Time/materials | authorized operational command | source entries, approvals and corrections | timer never authorizes charges |
| Invoice | CompleteAndInvoice | immutable issued snapshot, unique original/job, brand/terms/version | PDF has same meaning/figures; correction is new linked document |
| Payment | confirmed manual receipt or verified provider event | immutable fact, allocation/reversal, provider provenance | balance derived; customer report is pending only |
| Finance | balanced journal transaction | immutable lines and reversal link | reports rebuild without sending side effects |
| Tax | verified rule and explicit input snapshot | year/jurisdiction/formula/source/review version | missing inputs return review required; AI only explains |
| Communication | intent plus attempt evidence | template/recipient/connection version, provider result | accepted is not delivered/read; ambiguous send needs reconciliation |
| Assistant | permitted source queries / command results | evidence references, model/version, confirmed proposal | model text never changes money, capacity, eligibility or permission |

External payment/calendar facts retain provider provenance. Calendar content never edits commercial scope. Accounting exports never overwrite issued invoices. Projection replay is separate from dispatch and cannot enqueue duplicate external effects.
