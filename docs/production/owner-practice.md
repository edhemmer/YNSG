# Owner practice with sample data

Open **https://yourneighborhoodserviceguy.app/owner/practice**. No sign-in is needed because this route contains only fictional, browser-local data. The live sign-in screen and Settings link to it. Use fictional information only.

## Ready-to-use review sequence

| Sample record / screen | Try | Expected outcome |
| --- | --- | --- |
| New request | Read the full note; choose an open sample time; save an estimate; enter fictional agreement evidence | Confirm → complete → invoice → close out remains understandable; sample appointment appears; agreement does not send anything |
| Scheduled visit | Start, pause, resume | The real work screen advances and shows the corresponding status |
| Work in progress | Enter sample minutes/charges; check the review box; save work and complete | One completed sample job with a reviewed draft; no invoice issued automatically |
| Ready to invoice | Review saved charges; approve and issue the sample invoice | One sample invoice; open its document to check layout and amounts; SAMPLE — NOT A BILL remains visible |
| Partial payment | Record the remaining $60 as sample cash or Zelle with a fictional reference | $120 total, $120 received, $0 remaining; paid closeout; no actual funds represented |
| Paid visit | Read closeout and invoice | No remaining payment requested; history retained in the sample |
| Customers | Edit a fictional contact/address/name and add conversation notes | Current sample details update; original sample request remains unchanged |
| Mileage | Review seeded 12-mile trip; add a fictional trip; reverse one with a reason | Sample totals reconcile; no tax deduction or customer charge created |

Try phone rotation, larger text and dark/light mode while using these screens. **Reset sample data** restores the original six scenarios. Reload retains changes when tab storage is available; private/restricted browsing can keep them only in memory. Closing the tab ends its normal tab-storage lifetime. **Exit to live workspace** returns to real sign-in; sample records never become live data.

## Boundaries and evidence

This is UI rehearsal using the actual request inbox, guided service workflow, scheduling review, work/draft editor, invoice/payment components, customer editor, notes, mileage and invoice document. Responses and state transitions are simulated in the browser. It is not a staging database, authorization test or proof of canonical server behavior.

No production customer records are read or copied. All transport on this exact route uses the local practice adapter; unknown operations fail closed with no network fallback. This route does not alter production authentication, grants or canonical commands. Calls, email links, maps, invoice navigation and file/provider links inside the practice surface are intercepted. Invoice links open the real document component with local sample data. No server API, database migration, email, calendar, payment provider, delegated access, account creation, file upload/import/export, paid service or new hosted project is activated.

Sample scheduling checks overlaps and a 15-minute sample buffer, not Google routing or the reported October 19 conflict. Sample issuing uses fictional tax readiness, not actual business/tax approval. Email controls explicitly remain disabled. Live inbox receipt, signed-in customer history, file integrity/retention/deletion, real travel/provider behavior, independent security review, backup/alert/rollback and physical-device acceptance remain separate. Missing engineering identified in the completion register is not closed by practice.

Automated evidence: `tests/owner-practice.test.ts` covers contracts, states, replay, stale revisions, exact balances, isolation, blocked routes, edit preservation, mileage and reset. `tests/practice-experience.test.mjs` exercises the real screens for scheduling/estimate/agreement, timer controls, completion/issuing, partial-payment closeout/document, safe links and customer navigation with network calls forced to fail. These tests do not replace canonical SQL/CI or actual device acceptance.
