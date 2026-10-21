import {prepareFieldBrief} from './field-preparation.ts';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from './request-inbox.ts';
export type FieldAgentTask={id:string;kind:'review'|'schedule'|'quote'|'work'|'invoice'|'payment'|'follow_up';title:string;detail:string;requiresOwnerApproval:true;status:'proposed'};
/** Pure orchestrator. Produces suggestions; no database writes, external AI calls, sends or payment claims. */
export function prepareAgentPlan(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]):FieldAgentTask[]{
 const brief=prepareFieldBrief(request,quotes,jobs,invoices);
 if(['declined','canceled'].includes(request.status)||!brief.requiresOwnerDecision)return [];
 const task=({kind,title,detail}:{kind:FieldAgentTask['kind'];title:string;detail:string}):FieldAgentTask=>({id:request.id+':'+kind,kind,title,detail,requiresOwnerApproval:true,status:'proposed'});
 if(!brief.hasConfirmedVisit)return [task({kind:'schedule',title:'Review appointment',detail:'Review the requested time, service area and scope before confirming or suggesting an alternative.'})];
 if(!quotes.length)return [task({kind:'quote',title:'Prepare scope and price',detail:'Review requested services, labor estimate and customer agreement before recording a quote.'})];
 if(jobs.some(j=>j.status==='working'||j.status==='paused'))return [task({kind:'work',title:'Continue work',detail:'Check recorded labor, materials, and notes before completing the job.'})];
 if(jobs.some(j=>j.status==='completed'&&!invoices.some(i=>i.job_id===j.id)))return [task({kind:'invoice',title:'Review invoice draft',detail:'Reconcile actual work, charges and tax before intentionally issuing an invoice.'})];
 if(brief.phase==='closeout')return [task({kind:'payment',title:'Review outstanding receipt',detail:'Confirm only cash or Zelle actually received; never credit an expected transfer.'})];
 return [task({kind:'review',title:brief.next,detail:brief.notes[0]||'Review the saved customer and job record before proceeding.'})];
}
