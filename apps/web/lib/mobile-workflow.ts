import {serviceNextStep} from './service-workflow.ts';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from './request-inbox.ts';
export type MobilePhase='visit'|'work'|'invoice'|'closeout';
export const mobilePhases=[{id:'visit',label:'Confirm',icon:'calendar'},{id:'work',label:'Complete',icon:'work'},{id:'invoice',label:'Invoice',icon:'money'},{id:'closeout',label:'Close out',icon:'check'}] as const;
export function mobileWorkflow(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]){
 const next=serviceNextStep(request,quotes,jobs,invoices);
 const unbilled=jobs.filter(j=>j.status!=='canceled'&&!invoices.some(i=>i.job_id===j.id));
 const balance=invoices.reduce((sum,i)=>sum+Math.max(0,i.total_cents-i.payments.reduce((s,p)=>s+p.cents,0)),0);
 const settled=invoices.length>0&&unbilled.length===0&&balance===0;
 const phase:MobilePhase=next.step<=3?'visit':next.step===4?'work':next.step===5?'invoice':'closeout';
 return {next,phase,settled,balance,unbilled};
}
