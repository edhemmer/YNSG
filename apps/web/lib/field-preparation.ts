import {requestTasks,visitState,type InboxRequest,type LinkedQuote,type LinkedJob,type LinkedInvoice} from './request-inbox.ts';
import {mobileWorkflow} from './mobile-workflow.ts';

/** Read-only, deterministic preparation. Never infer consent, receipts or work completion. */
export function prepareFieldBrief(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]){
 const workflow=mobileWorkflow(request,quotes,jobs,invoices);
 const tasks=requestTasks(request.original_submission).map(t=>t.task||t.service).filter(Boolean);
 const visit=request.appointments.find(a=>visitState(a)==='reserved');
 const pendingProposal=request.appointments.some(a=>visitState(a)==='proposal');
 const working=jobs.filter(j=>j.status==='working').length;
 const paused=jobs.filter(j=>j.status==='paused').length;
 const notes:string[]=[];
 if(request.original_submission.description?.trim())notes.push('Read the customer instructions before agreeing to scope or beginning work.');
 if(!request.original_submission.street?.trim()||!request.original_submission.city?.trim())notes.push('Confirm the full service address before planning travel or scheduling.');
 if(tasks.length>3)notes.push('This request includes '+tasks.length+' jobs; review the entire list before confirming scope and time.');
 if(requestTasks(request.original_submission).some(t=>/mulch|material pickup/i.test((t.task||'')+' '+(t.service||''))))notes.push('Confirm supplier, materials payment, pickup location and travel time before agreeing to a mulch or materials run.');
 if(requestTasks(request.original_submission).some(t=>/pressure wash|concrete wash/i.test((t.task||'')+' '+(t.service||''))))notes.push('Verify customer-supplied outdoor water, surface suitability and drainage before pressure washing.');
 if(!visit&&pendingProposal)notes.push('A proposed appointment still needs an explicit scheduling decision.');
 if(visit&&quotes.length===0)notes.push('Prepare the estimate and record customer agreement before starting work.');
 if(working)notes.push('Work is in progress; verify recorded time and materials before completion.');
 if(paused)notes.push('Paused work must be resumed or reviewed before recording completion.');
 if(invoices.length&&workflow.balance>0)notes.push('Outstanding balance remains. Record only money actually received.');
 if(workflow.settled)notes.push('Saved invoices and confirmed receipts show no remaining balance.');
 // Prepared administrative checklist. Suggestions are read-only: no customer communication,
 // schedule approval, invoice issuance or receipt is inferred from this assessment.
 const preparedActions:{label:string;ownerApproval:boolean}[]=[];
 if(!visit&&pendingProposal)preparedActions.push({label:'Review proposed appointment and travel window',ownerApproval:true});
 if(!request.original_submission.street?.trim()||!request.original_submission.city?.trim())preparedActions.push({label:'Verify missing service address before dispatch',ownerApproval:true});
 if(visit&&!quotes.some(q=>q.status==='accepted'))preparedActions.push({label:'Prepare scope and estimate for customer approval',ownerApproval:true});
 if(jobs.some(j=>j.status==='completed'&&!invoices.some(i=>i.job_id===j.id)))preparedActions.push({label:'Prepare charges for invoice review',ownerApproval:true});
 if(invoices.length&&workflow.balance>0)preparedActions.push({label:'Review outstanding invoices and verified receipts',ownerApproval:true});
 return {next:workflow.next.title,phase:workflow.phase,services:tasks.slice(0,3),extraServices:Math.max(0,tasks.length-3),notes,preparedActions,hasConfirmedVisit:Boolean(visit),requiresOwnerDecision:!workflow.settled};
}
