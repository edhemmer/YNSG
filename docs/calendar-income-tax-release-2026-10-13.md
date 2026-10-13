# Visible calendar and state-aware income-tax review — October 13, 2026

Scope: Ed’s request to expose the calendar layout and use current rules for the owner’s state. Stripe remains excluded. Existing brand, service scope, $60/$45 rates, two-hour minimum and appointment authority remain unchanged.

## Acceptance checklist

| Requirement | Result | Evidence |
| --- | --- | --- |
| Public month grid appears without expanding a disclosure | PASS in source/build; live check follows deployment | Permanent calendar section precedes time controls and contact details |
| Clear owner entry to the calendar | PASS in source/build; live check follows deployment | Overview: Open month calendar |
| Date/time holds and recovery preserved | PASS | 13 existing calendar interaction tests |
| Current owner operating state sourced rather than universally assuming Illinois | PASS | Existing authenticated configuration endpoint; hosted region verified IL; saved tax profile takes precedence |
| State-specific and year-specific calculations | PASS | Illinois 2026 only; unsupported states/years show a worksheet-required explanation, never reuse Illinois or prior-year rates |
| Federal progressive calculation by filing status | PASS | IRS rate-schedule boundary fixtures for all five filing statuses |
| Self-employment and Additional Medicare kept separate | PASS | $184,500 wage base, 92.35% net-profit adjustment, adjusted-earnings $400 threshold, Medicare rates/filing thresholds tested |
| Illinois base income, exemptions, withholding and credits | PASS | 4.95% and greater-than-$1,000 estimated-payment threshold tested |
| Calculate → review → explicit publish → saved plan/calendar | PASS in synthetic UI/API interaction test | No automatic financial write; copied inputs/amounts retain review evidence |
| Editing calculator input invalidates displayed result | PASS | React interaction test |
| Required checks | PASS | 284 application tests, root/app types, PGlite lifecycle fixtures, production dependency audit; Next production build |
| Actual owner personal income/exemptions/filing status verified | OPEN | Owner must supply these; CRM receipts do not establish taxable income |
| Actual owner tax setup published | OPEN | No invented personal figures or accountant approval saved to production |
| Full launch certification | OPEN | Prior service-workflow release gates remain applicable |

## Verified government sources

- IRS 2026 Form 1040-ES: https://www.irs.gov/pub/irs-pdf/f1040es.pdf — standard deductions, progressive schedules, Social Security wage base, self-employment worksheet, estimated-payment rules and deadlines.
- IRS Topic 560: https://www.irs.gov/taxtopics/tc560 — Additional Medicare thresholds/rate.
- Illinois 2026 IL-1040-ES (September 2026 revision): https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-es.pdf — Illinois base less exemptions, 4.95%, surcharges, withholding/credits, $1,000 threshold and whole-dollar installments.

## Calculation boundaries

This is an ordinary-income, individual calendar-year planning worksheet for a full-year Illinois resident and one person’s self-employment profit. User confirms this scope. Company operating region suggests the state when no reviewed tax profile exists; it does not establish personal residency. Saved tax state takes precedence. Other resident states, multi-state returns and entity returns need their own reviewed worksheet. Future-year rates require a source-verified update.

Federal taxable income is supplied **after** applicable deductions; the basic standard deduction is shown as a reference, not subtracted twice. Deductible half of SE tax is displayed for the income worksheet. Qualified business income, senior and other deduction eligibility are not guessed. The user supplies other federal taxes, nonrefundable credits separately from withholding/refundable credits, and Illinois exemptions/credits.

The copied annual plan uses the full projected remaining liability with threshold checks, not a certified minimum safe-harbor calculation. Prior-year safe harbors, annualization, special exceptions, spouse self-employment, preferential capital-gain/dividend rates, foreign/RRTA income and special SE exemptions require the completed official worksheet. Already recorded estimated payments remain separately allocated to deadlines, preventing accidental deduction twice.

Income-tax calculations do not authorize invoice sales tax, change old invoice snapshots, mark business tax treatment verified, file returns or send money. Owner can adjust reviewed annual plan amounts before publication. No real booking, email, invoice or payment was created during this release’s tests.
