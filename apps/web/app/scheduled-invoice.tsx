'use client';
import type {InboxRequest,LinkedQuote,LinkedJob} from '../lib/request-inbox';
import {requestTiming} from '../lib/request-inbox';
export default function ScheduledInvoice({request,quotes,jobs,timezone,onOpen,busy=false,compact=false}:{request:InboxRequest;quotes:LinkedQuote[];jobs:LinkedJob[];timezone:string;onOpen?:()=>void;busy?:boolean;compact?:boolean}){
 const visit=request.appointments.find(a=>a.status==='reserved');
 if(!visit||['canceled','declined'].includes(request.status))return null;
 const job=jobs.find(j=>j.id===visit.job_id&&j.status!=='canceled');
 const quote=job?quotes.find(q=>q.id===job.quote_id&&q.status==='accepted'):undefined;
 const version=quote?.quote_versions.find(v=>v.version===(job?.approved_version??quote.current_version));
 return <section className={'workflow-section scheduled-invoice'+(compact?' scheduled-invoice-compact':'')} aria-label={'Pending invoice for '+request.original_submission.name}>
  <h3>{compact?'Pending invoice':'Pending invoice · '+request.original_submission.name}</h3>
  <p className="status-pill">{!version?'Awaiting agreed price':job?.status==='completed'?'Ready for invoice review':['working','paused'].includes(job?.status||'')?'Work started · invoice pending':'Awaiting work'}</p>
  {!compact&&<p>{requestTiming({...request,appointments:[visit]},timezone).text}</p>}
  {version?<>{!compact&&<p>{version.scope}</p>}<p>Agreed labor estimate: <strong>{(version.labor_cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</strong> · {version.duration_minutes/60} hours</p></>:<p>The appointment is saved. Agree on the scope and price with the customer to fill in this preview.</p>}
  {compact?<details><summary>Estimate & billing details</summary><p>No payment is due from this preview. Actual work, approved extras and applicable tax are reviewed before an invoice is issued. Materials are paid directly to the supplier.</p></details>:<p>No payment is due from this preview. Actual work, approved extras and applicable tax are reviewed before an invoice is issued. Materials are paid directly to the supplier.</p>}
  {onOpen&&<button type="button" className={compact?undefined:'secondary'} disabled={busy} onClick={onOpen}>{version?(compact?'Open work & invoice':'Open appointment, work & invoice'):'Review scope & price'}</button>}
 </section>;
}
