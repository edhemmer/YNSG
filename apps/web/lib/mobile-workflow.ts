import {creditTotal} from './invoice-credit-contract.ts';
import {ownerRequestNextStep} from './service-workflow.ts';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from './request-inbox.ts';
export type MobilePhase='visit'|'work'|'invoice'|'closeout';
export const mobilePhases=[{id:'visit',label:'Confirm',icon:'calendar'},{id:'work',label:'Complete',icon:'work'},{id:'invoice',label:'Invoice',icon:'money'},{id:'closeout',label:'Close out',icon:'check'}] as const;
export function mobileWorkflow(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]){
 const next=ownerRequestNextStep(request,quotes,jobs,invoices);
 const unbilled=jobs.filter(j=>j.status!=='canceled'&&!invoices.some(i=>i.job_id===j.id));
 const balance=invoices.reduce((sum,i)=>sum+Math.max(0,i.total_cents-creditTotal(i.credits)-i.payments.reduce((s,p)=>s+p.cents,0)),0);
 const settled=!['declined','canceled'].includes(request.status)&&request.appointments.some(a=>a.status==='reserved')&&invoices.length>0&&unbilled.length===0&&balance===0;
 const phase:MobilePhase=next.step<=3?'visit':next.step===4?'work':next.step===5?'invoice':'closeout';
 return {next,phase,settled,balance,unbilled};
}

/** Navigation offers only actions supported by saved workflow evidence. */
export function availableMobilePhases(request:InboxRequest,jobs:LinkedJob[],invoices:LinkedInvoice[]):MobilePhase[]{
 const confirmed=request.appointments.some(a=>a.status==='reserved');
 if(!confirmed||['declined','canceled'].includes(request.status))return ['visit'];
 const completed=jobs.some(j=>j.status==='completed');
 const billed=invoices.length>0;
 return ['visit','work',...(completed||billed?['invoice' as const]:[]),...(billed?['closeout' as const]:[])];
}
