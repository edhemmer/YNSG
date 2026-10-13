# Accepted quote workflow crash — October 13, 2026

Ed supplied the mobile error-page screenshot while reviewing quotes/invoices. The production failure was reproduced by opening an accepted quote with a saved job that had no issued invoice. The browser reported `TypeError: Cannot read properties of null (reading 'length')` in the service-workflow render. Runtime server logs did not report this client rendering error.

The unique job-to-invoice relation selected through PostgREST is an object or null, not a list. The previous component called `j.invoices.length`. It crashed even for approved work, before the timer or invoice draft appeared.

The component now checks the canonical, separately loaded invoice list by `job_id`. The unused embedded invoice relation was removed from both workspace query paths and the job type. Selected-request queries still load all related invoices, preserving the existing paging protections. Issued invoices suppress draft creation and keep the existing payment/delivery workflow.

## Scope checklist

| Requirement | Result |
| --- | --- |
| Reproduce the supplied error in the real accepted-quote workflow | PASS: browser TypeError and matching error boundary |
| Approved job without invoice renders the work controls | PASS: regression fixture |
| Working, paused and completed jobs without invoice render draft controls | PASS: regression fixtures |
| Issued invoice renders the linked invoice and suppresses another draft | PASS: fixtures cover null/object/array legacy relation shapes |
| Existing calendar/tax updates retained | PASS: source review and live public calendar / Illinois tax-screen checks |
| Application tests, types, DB fixtures and production dependency audit | PASS: 285 tests and required checks |
| Next production build | PASS after discarding corrupt generated local Turbopack cache |
| Live post-deployment acceptance | Check the same saved accepted quote after production deployment |
| Preserve owner edits / avoid synthetic financial records | No quote agreement, timer, invoice, payment, tax setup or customer message changed during investigation |

The visible public month grid is deployed, and selecting an open date updates the available times without creating a hold. The owner tax screen loads IL from current configuration and shows the verified 2026 rates. Actual owner tax inputs and a reviewed personal tax plan remain outstanding. Part-year/multi-state returns, capital gains and other unsupported tax situations still require completed official worksheets; the limited ordinary-income calculator must not be used as a complete personal return.
