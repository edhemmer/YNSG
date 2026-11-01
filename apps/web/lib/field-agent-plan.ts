import {prepareFieldBrief} from './field-preparation.ts';
import {ownerRequestNextStep} from './service-workflow.ts';
import {requestTasks,visitState,type InboxRequest,type LinkedQuote,type LinkedJob,type LinkedInvoice} from './request-inbox.ts';
export type FieldAgentTask={id:string;kind:'review'|'schedule'|'quote'|'work'|'invoice'|'payment'|'follow_up';title:string;detail:string;requiresOwnerApproval:true;status:'proposed'};
/** Pure orchestrator. Produces suggestions; no database writes, external AI calls, sends or payment claims. */
export function prepareAgentPlan(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]):FieldAgentTask[]{
 const brief=prepareFieldBrief(request,quotes,jobs,invoices);
 if(['declined','canceled'].includes(request.status)||!brief.requiresOwnerDecision)return [];
 const task=({kind,title,detail}:{kind:FieldAgentTask['kind'];title:string;detail:string}):FieldAgentTask=>({id:request.id+':'+kind,kind,title,detail,requiresOwnerApproval:true,status:'proposed'});
 // Follow the authoritative saved-state decision, never infer progress from record counts.
 // In particular, an existing quote does not establish customer acceptance, and
 // an invoice does not establish that payment was received.
 const next=ownerRequestNextStep(request,quotes,jobs,invoices);
 if(next.step===7)return [];
 if(next.action==='schedule')return [task({kind:'schedule',title:next.title,detail:next.detail})];
 if(next.step===3)return [task({kind:'quote',title:next.title,detail:next.detail})];
 if(next.step===4)return [task({kind:'work',title:next.title,detail:next.detail})];
 if(next.step===5)return [task({kind:'invoice',title:next.title,detail:next.detail})];
 if(next.step===6)return [task({kind:'payment',title:next.title,detail:'Review the issued invoice and confirm only money actually received. Cash and Zelle are not automatically verified.'})];
 return [task({kind:'review',title:next.title,detail:next.detail||'Review the saved customer and job record before proceeding.'})];
}

/** Draft for owner review only; never queued or sent by this function. */
export function prepareCustomerFollowUp(request:InboxRequest):{subject:string;body:string;requiresOwnerApproval:true;status:'draft'}|null{
 if(['declined','canceled'].includes(request.status)||request.appointments.some(a=>visitState(a)==='reserved'))return null;
 // Customer-supplied fields are only used in this editable draft, never sent to a model.
 const clean=(value:string,limit:number)=>value.replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
 const name=clean(String(request.original_submission.name||''),80).split(' ')[0]||'there';
 const tasks=requestTasks(request.original_submission).slice(0,2).map(t=>clean(String(t.task||t.service||''),90)).filter(t=>t&&t!=='Details to review');
 const summary=tasks.join(' and ');
 const service=summary||'your home or yard project';
 return {subject:'Your Neighborhood Service Guy — appointment follow-up',
  body:`Hi ${name},\n\nThank you for contacting Your Neighborhood Service Guy about ${service}. I am reviewing the details and will confirm the next steps with you. Your requested appointment is not confirmed until you receive a confirmation.\n\nEd Hemmer\nYour Neighborhood Service Guy`,
  requiresOwnerApproval:true,status:'draft'};
}
