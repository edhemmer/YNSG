# Field OS structure and interaction rebuild — November 3, 2026

The owner rejected the previous release as fragmented. Passing engineering checks did not establish an acceptable product experience. This change addresses shared structure, navigation context and everyday interaction, without declaring the entire product accepted.

## Structural changes

| Area | Result | Source |
| --- | --- | --- |
| Job identity and layout | Owner and assigned technician share one record frame, header, view navigation and reference area. Original customer instructions, appointment and verified amounts stay attached to that record. On phones, reference follows the working area so timer controls are visible earlier. | `apps/web/app/job-workspace.tsx`, `service-workflow.tsx`, `field-work.tsx` |
| Navigation | Opening a job retains its valid Today/Requests/Schedule/Jobs origin in the navigation. Direct links still fall back to Jobs. Tablet/narrow desktop windows use field navigation instead of squeezing a desktop sidebar into the work area. | `workspace.tsx`, `field-system.css` |
| Today | Current work and owner decisions use a desktop workboard; remaining jobs and upcoming stops are visible in an initially expanded queue. Phone order remains current action, decisions, other work. Existing chronology, exact-job deduplication and independent decision evidence remain unchanged. | `command-center.tsx` |
| Settings | Connections, Business, Phone alerts and Security are separate destinations. Visited sections retain mounted drafts. Business, rates, scheduling and services are focused form sections; invalid fields reveal the relevant section. One Save action validates and publishes with the same canonical revision and exact-attempt recovery. | `owner-settings.tsx`, `company-settings.tsx` |
| Billing | An invoice register supports customer/number/address/scope search and due/settled filters on the loaded records page. Expanding a row reads only that invoice's tools, retains them and any edits when collapsed, and links back to its job when authorized and available. Amounts still derive from immutable invoice totals, recorded payments and credits. | `billing-register.tsx` |

## Experience acceptance

- Test the actual app components at 320/390/768/1366 widths in light and dark themes, including 200% text.
- On a 390 × 844 phone working-job view, Pause and Finish must be visible without scrolling past reference information.
- Changing settings destinations/categories must retain edits. An invalid field in another category must open that category; no command may be sent until valid.
- A settings save must send one command; ambiguous results lock edits and replay exactly the original body/key. Late results must not affect another business.
- Opening or searching an invoice register must not send mail, invent work or record funds. Closed invoices must not fetch all their tools; reopening must preserve the same edited tools.
- Original request, exact accepted quote, actual timer, reviewed completion, invoice issue and actual receipt remain distinct evidence. Simplifying navigation is not authority to manufacture any of them.

## External reference

Reviewed current primary documentation: [Jobber app navigation](https://help.getjobber.com/en/articles/jobber-app-basics/), [Jobber jobs](https://getjobber.zendesk.com/hc/en-us/articles/8185260991127-Jobs-in-the-Jobber-App), [Housecall Pro job details](https://help.housecallpro.com/en/articles/3181752-how-to-create-a-job). The useful patterns are a persistent job record, predictable field navigation and access to job/schedule/invoice information together. No source establishes that this app is better than those products.

## Release evidence and limits

Local focused recovery/navigation tests, complete field lifecycle browser checks, full-shell browser checks and readability checks are recorded in the PR. Final exact-head Linux application/browser and native PostgreSQL checks, production deployment mapping and live read-only checks are required before merge/release claims. No paid AI/provider activation, public website design change or schema change is included. The production catalog corrections were separately published as version 8 through the actual owner form and independently verified before this code change. Actual tax review and human/provider/device/operational acceptance remain open; this release does not fabricate them or certify whole-product completion.
