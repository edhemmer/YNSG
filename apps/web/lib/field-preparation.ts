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
 if(!visit&&pendingProposal)notes.push('A proposed appointment still needs an explicit scheduling decision.');
 if(visit&&quotes.length===0)notes.push('Prepare the estimate and record customer agreement before starting work.');
 if(working)notes.push('Work is in progress; verify recorded time and materials before completion.');
 if(paused)notes.push('Paused work must be resumed or reviewed before recording completion.');
 if(invoices.length&&workflow.balance>0)notes.push('Outstanding balance remains. Record only money actually received.');
 if(workflow.settled)notes.push('Saved invoices and confirmed receipts show no remaining balance.');
 return {next:workflow.next.title,phase:workflow.phase,services:tasks.slice(0,3),extraServices:Math.max(0,tasks.length-3),notes,hasConfirmedVisit:Boolean(visit),requiresOwnerDecision:!workflow.settled};
}
