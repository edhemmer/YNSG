# CRM experience redesign — October 8, 2026

Latest owner direction: requests are arriving, all connections are active and live; replace the confusing layout and disconnected calendar management with a premium, logical end-to-end CRM. This overrides older product-screen text claiming connections are not configured. Existing authentication and command verification remain required.

| Requirement | Pass condition |
|---|---|
| Existing project and live integrations | Continue existing source and canonical server commands; preserve tenant/session boundaries, approved sender, workers and calendar |
| Premium presentation | Coherent navy/green/gold identity, restrained graphics, persistent navigation, clear hierarchy, readable labels, polished states |
| New requests easy to locate | Dedicated Requests inbox, needs-review filter, search, newest-first ordering, independent pagination and exact counts |
| Calendar connected to actions | Month/week/day views show names and timing; appointments open the same request detail without reloading/signing in; confirmation and decline controls are accessible there |
| Clear decisions | Start review automatically as part of scheduling, then validate actual scope/resources/travel and fresh Google facts; no fabricated zero travel or compliance approval |
| End-to-end context | Show requested work, customer/contact/location, requested timing, appointment history, customer rescheduling preferences and linked quote/job/invoice stages |
| Existing work and billing | Preserve quote approval, start/pause/resume, completion, invoice review/send and actual payment recording; navigation carries linked record context |
| Smarter automation UX | Automatic bounded refresh while visible, manual recovery, accurate message/calendar state and a visible exceptions destination; no fake delivery claims |
| Mobile and accessibility | No horizontal overflow at phone width; 44+px controls, keyboard/focus support, large-text/reduced-motion support, labels/status beyond color |
| SaaS-ready identity | Preserve company-configured colors/name; never give platform or other company access to operational records |
| Business constraints | Preserve logo, catalog and allowed services, $60/$45 rates, one 2-hour minimum, last start 3pm; no customer data/IDs or implementation diagnostics exposed publicly |
| No unintended live effects | No real customer sends, appointment changes, DNS/protection changes, paid services or new provider activation during QA |
| Evidence | Full changed-file and generated-deliverable review; type/build/unit/database plus desktop/mobile workflow tests; distinguish synthetic and live-read evidence |

Primary patterns researched: Jobber request-to-quote/job workflow and Needs Approval inbox; Housecall Pro schedule views, unscheduled queue and Needs Attention. Use these as interaction patterns, not claims of feature parity or source copying.
