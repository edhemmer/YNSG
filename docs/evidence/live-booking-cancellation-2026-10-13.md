# Live booking and cancellation evidence — October 13, 2026

## Authorized scope and constraints

Ed approved one clearly marked “QA TEST — DO NOT VISIT” request for Tuesday, October 20, 2026 at 9 AM Central, using his Gmail recipient, public business phone and synthetic “100 Test Street, DeKalb” address. The authorization included owner confirmation, cancellation and test emails only to his inbox. It excluded actual service, quotation, invoicing, money, Stripe, customer account creation, and changes to other customers' records.

The test ran through the normal website and signed-in owner CRM. Supabase reads checked the saved states; Gmail reads checked actual inbox messages. No privileged SQL mutation or alternate submission path was used.

## Pass/fail checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Correct recipient | PASS | Connected Gmail profile and current owner recipient both resolve to Ed's approved Gmail address. Every QA message has only that To recipient, with no CC/BCC. |
| Correct appointment | PASS | October 20, 9–11 AM CDT; one-time leaf-management test. Both UI and saved timestamps match the two-hour window. |
| Website submission | PASS | Public success screen and exactly one durable request with one proposed appointment. The website did not claim owner approval before confirmation. |
| Owner approval | PASS | Normal Approve action produced one confirmed appointment and one active operator reservation. |
| No unwanted financial work | PASS | No quote, job, invoice or payment was created for this request. |
| Cancellation | PASS | Normal Cancel action stored canceled appointment revision 4, retained the request and queued one cancellation notice. |
| Capacity released | PASS | Zero active reservations afterward; the public calendar offered October 20 at 9 AM again, without creating another hold. |
| Reminders and old links stopped | PASS | Both future reminder messages were suppressed without a send attempt; zero pending appointment tasks and zero unrevoked, unexpired customer action links. |
| Emails arrived | PASS | Four distinct expected messages were read in Gmail with the INBOX label, each corresponding to one accepted provider attempt. |
| Duplicate protection in this run | PASS | One saved request, one appointment and one cancellation notice. No redundant owner-confirmation message appeared. |
| Other records preserved | PASS | Actions targeted only the marked QA request; no other customer mutation was performed. |

## Actual inbox receipts

Times below are Central Daylight Time on October 13, 2026.

| Purpose | Subject | Gmail timestamp |
| --- | --- | --- |
| Customer receipt | Your Neighborhood Service Guy — Service request received | 2:32:02 PM |
| Owner alert | Your Neighborhood Service Guy New Request | 2:32:03 PM |
| Customer confirmation | Your appointment is confirmed | 2:32:07 PM |
| Cancellation | Your appointment has been canceled | 2:35:05 PM |

Ed received all four because he acted as both test customer and business owner. These are four different lifecycle purposes, not repeated owner-confirmation emails. Text, recipient, reply-to and the Tuesday/9 AM CDT date were reviewed. The cancellation explicitly says no visit, work, invoice or payment is required.

## Owner-guidance issue found

The assistant showed two automation items needing attention while Activity correctly reported zero due emails. The items were optional calendar projections. The repair makes both views use the same email-kind and due-status rules, makes cancellation/request receipts visible on failure, and uses approved managed-mail readiness. A regression check covers failed cancellation visibility and exclusion of calendar exports from email alerts.

## Limits and remaining gates

This proves the authorized live booking/approval/cancellation/email story. It does not certify invoice issuance, actual money receipt, tax treatment, recurring reservations, physical-device accessibility, disaster recovery or franchise operations. Tax review, a legitimate invoice/payment walkthrough, actual reminder delivery, backups/alerts, and the remaining launch checklist are still open.

The QA request is clearly marked and retained as request history. It remains open for review under the product's normal cancellation behavior; no visit or work is booked. Optional Google export intents may wait for an enabled external connection. The CRM calendar is authoritative, and this wait does not reserve capacity or represent an undelivered customer email.
