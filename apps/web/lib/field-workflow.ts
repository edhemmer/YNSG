import {ownerRequestNextStep} from './service-workflow.ts';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from './request-inbox.ts';
/** Saved evidence chooses the field task. A timer never bypasses scheduling or agreement checks. */
export function fieldWorkflow(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]){
 const next=ownerRequestNextStep(request,quotes,jobs,invoices);
 const pending=jobs.filter(j=>j.status!=='canceled'&&!invoices.some(i=>i.job_id===j.id));
 if(next.step===0)return {kind:'closed' as const,label:'Request closed',next,job:null};
 if(next.action==='schedule')return {kind:'confirm' as const,label:'Confirm appointment',next,job:null};
 if(next.step<=3)return {kind:'agreement' as const,label:'Agree on work & price',next,job:null};
 if(next.step===5)return {kind:'invoice' as const,label:'Review & issue invoice',next,job:pending.find(j=>j.status==='completed')||null};
 if(next.step===6)return {kind:'payment' as const,label:'Record money received',next,job:null};
 if(next.step===7)return {kind:'settled' as const,label:'Closed out',next,job:null};
 const job=pending.find(j=>j.status==='working')||pending.find(j=>j.status==='paused')||pending[0]||null;
 return {kind:job?.status==='working'?'working' as const:job?.status==='paused'?'paused' as const:'ready' as const,label:job?.status==='working'?'Work in progress':job?.status==='paused'?'Work paused':'Ready to work',next,job};
}
