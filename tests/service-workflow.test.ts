import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceNextStep,invoiceIssuanceReadiness,invoiceDraftFingerprint} from '../apps/web/lib/service-workflow.ts';
import {currentBusinessEvidence,type BusinessSnapshot} from '../apps/web/lib/business-snapshot.ts';
import {businessBrief} from '../apps/web/lib/business-assistant.ts';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from '../apps/web/lib/request-inbox.ts';
const request:InboxRequest={id:'request',status:'reviewing',revision:1,created_at:'2026-10-13T12:00:00Z',original_submission:{name:'Synthetic Neighbor',email:'test@example.invalid',phone:'5550000000',street:'Test only',city:'DeKalb'},appointments:[]};
const quote:LinkedQuote={id:'quote',request_id:'request',status:'sent',current_version:1,quote_versions:[{version:1,scope:'Agreed assembly',labor_cents:12000,duration_minutes:120}]};
const job:LinkedJob={id:'job',quote_id:'quote',revision:1,status:'approved'};
const invoice:LinkedInvoice={id:'invoice',job_id:'job',number:1,total_cents:12000,payments:[]};
test('one request progresses through agreement, actual work, issued invoice and received split payments',()=>{
 assert.equal(serviceNextStep(request,[],[],[]).action,'schedule');
 assert.equal(serviceNextStep(request,[quote],[],[]).step,3);
 assert.equal(serviceNextStep(request,[{...quote,status:'accepted'}],[job],[]).step,2); // Appointment is still required.
 const confirmed={...request,appointments:[{id:'visit',request_id:request.id,job_id:job.id,status:'reserved',revision:1,start_at:'2030-10-16T14:00:00Z',arrival_at:'2030-10-16T14:00:00Z',end_at:'2030-10-16T16:00:00Z',expires_at:null,replaces_id:null,customer_response:'confirmed'}]};
 assert.equal(serviceNextStep(confirmed,[{...quote,status:'accepted'}],[job],[]).step,4);
 assert.equal(serviceNextStep(request,[quote],[{...job,status:'completed'}],[]).step,5);
 assert.equal(serviceNextStep(request,[quote],[job],[invoice]).step,6);
 assert.equal(serviceNextStep(request,[quote],[job],[{...invoice,payments:[{cents:5000}]}]).step,6);
 assert.equal(serviceNextStep(request,[quote],[job],[{...invoice,payments:[{cents:5000},{cents:7000}]}]).title,'Paid and complete');
 assert.equal(serviceNextStep({...request,status:'canceled'},[],[],[]).title,'Request closed');
});
test('invoice readiness explains actual seller/terms/tax blocks without inventing approval',()=>{
 assert.equal(invoiceIssuanceReadiness(null,false).reasons.length,3);
 const cfg={sellerVerified:true,sellerLegalName:'Synthetic test only',invoiceTerms:'Due on completion',taxTreatmentVerified:false,laborTaxTreatment:'unreviewed'};
 assert.equal(invoiceIssuanceReadiness(cfg,false).ready,false);
 assert.match(invoiceIssuanceReadiness(cfg,false).reasons[0]!,/Tax treatment/);
 assert.equal(invoiceIssuanceReadiness(cfg,true).ready,true); // Reviewed tax profile still has its own issuance gate.
 assert.equal(invoiceIssuanceReadiness({...cfg,taxTreatmentVerified:true,laborTaxTreatment:'reviewed_non_taxable'},false).ready,true);
});
test('database JSON key order does not invalidate an unchanged reviewed draft, but changed money does',()=>{
 const a={description:' Assembly ',chargedCents:12000,recordedMinutes:120,billingBasis:'fixed'};
 const b={billingBasis:'fixed',recordedMinutes:120,chargedCents:12000,description:'Assembly'};
 assert.equal(invoiceDraftFingerprint([a]),invoiceDraftFingerprint([b]));
 assert.notEqual(invoiceDraftFingerprint([a]),invoiceDraftFingerprint([{...b,chargedCents:13000}]));
});
test('assistant blocks stale or invalid evidence and cannot overlook completed work without an invoice',()=>{
 const now=Date.parse('2026-10-13T16:00:00Z');
 const data:BusinessSnapshot={checkedAt:new Date(now).toISOString(),from:'2026-10-01',to:'2026-10-13',timezone:'America/Chicago',counts:{customers:0,requestsInPeriod:0,requestsToReview:0,upcomingVisits:1,proposals:0,working:0,paused:0,completed:1,quotes:0,messagesToCheck:0,rescheduleRequests:0,jobsNeedingInvoice:1},finance:{cashReceivedCents:0,expenseCents:0,cashAfterExpensesCents:0,issuedInvoicesCents:0,outstandingAsOfEndCents:0,paymentCount:0,expenseCount:0},email:{enabled:true,automaticSending:true}};
 assert.equal(currentBusinessEvidence(data,now),true);
 assert.equal(currentBusinessEvidence(data,now+121000),false);
 assert.equal(currentBusinessEvidence({...data,counts:{...data.counts,jobsNeedingInvoice:-1}},now),false);
 assert.equal(businessBrief(data)[0]?.id,'invoices');
 assert.equal(businessBrief(data)[0]?.section,'Work');
});

test('an accepted four-hour scope cannot be shown ready inside a two-hour visit',()=>{
 const visit={id:'visit',request_id:request.id,job_id:job.id,status:'reserved',revision:1,start_at:'2026-10-16T14:00:00Z',arrival_at:'2026-10-16T14:00:00Z',end_at:'2026-10-16T16:00:00Z',expires_at:null,replaces_id:null,customer_response:'confirmed'};
 const agreed={...quote,status:'accepted',quote_versions:[{...quote.quote_versions[0]!,duration_minutes:240}]};
 assert.equal(serviceNextStep({...request,appointments:[visit]},[agreed],[job],[]).action,'schedule');
 assert.match(serviceNextStep({...request,appointments:[visit]},[agreed],[job],[]).detail,/4 hours/);
 assert.equal(serviceNextStep({...request,appointments:[{...visit,end_at:'2026-10-16T18:00:00Z'}]},[agreed],[job],[]).action,'work');
});
