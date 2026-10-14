'use client';
import {useState} from 'react';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from '../lib/request-inbox';
import {requestTasks,requestTiming,visitState} from '../lib/request-inbox';
import {serviceNextStep} from '../lib/service-workflow';
import {invoiceNumber} from '../lib/invoice-number';
import InvoiceDraft from './invoice-draft';
import ScheduledInvoice from './scheduled-invoice';
import InvoiceDelivery from './invoice-delivery';
import InvoicePayments from './invoice-payments';
type Job=LinkedJob;
const money=(n:number)=>(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function ServiceWorkflow({organization,request,quotes,jobs,invoices,timezone,canManage,canQuote,canWork,busy,onBusy,onReview,act,fieldAction,onChanged}:{organization:string;request:InboxRequest;quotes:LinkedQuote[];jobs:Job[];invoices:LinkedInvoice[];timezone:string;canManage:boolean;canQuote:boolean;canWork:boolean;busy:boolean;onBusy:(v:boolean)=>void;onReview:()=>void;act:(value:Record<string,unknown>)=>Promise<unknown>;fieldAction:(job:Job,action:'start'|'pause'|'resume')=>Promise<void>;onChanged:()=>void}){
 const next=serviceNextStep(request,quotes,jobs,invoices),timing=requestTiming(request,timezone);
 const completedSteps=[true,request.appointments.some(a=>visitState(a)==='reserved'),quotes.some(q=>q.status==='accepted'),jobs.length>0&&jobs.every(j=>j.status==='completed'||j.status==='canceled'),invoices.length>0,invoices.length>0&&invoices.every(i=>i.payments.reduce((n,p)=>n+p.cents,0)>=i.total_cents)];
 return <section className="card service-workflow" aria-label={'Service workflow for '+request.original_submission.name}>
  <header><p className="eyebrow">One request, from start to finish</p><h2>{request.original_submission.name}</h2><p>{request.original_submission.street}, {request.original_submission.city}</p><p>{requestTasks(request.original_submission).map(t=>t.task||t.service).join(' · ')}</p></header>
  <ol className="service-steps" aria-label="Service progress">{['Request','Appointment','Scope & price','Work','Invoice','Payment'].map((label,i)=><li key={label} className={completedSteps[i]?'is-done':next.step===i+1?'is-current':''} aria-current={next.step===i+1?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
  <div className="workflow-next" role="status"><strong>Next: {next.title}</strong><p>{next.detail}</p></div>
  <section className="workflow-section"><h3>Appointment</h3><p>{timing.label}: <strong>{timing.text}</strong></p><button type="button" className="secondary" disabled={busy} onClick={onReview}>{next.action==='schedule'?'Choose or confirm a time':'Review appointment & request'}</button></section>
  {next.step>0&&<section className="workflow-section"><h3>Scope & price</h3>
   {!quotes.length&&<><p>Save the work and estimated labor amount. Nothing is emailed or approved automatically.</p>{canQuote&&request.status==='submitted'&&<button disabled={busy} onClick={()=>void act({command:'ReviewRequest',id:request.id,revision:request.revision,status:'reviewing'})}>Review this work for a price</button>}{canQuote&&request.status==='reviewing'&&<WorkflowQuoteForm request={request} busy={busy} submit={act}/>}</>}
   {quotes.map(q=>{const v=q.quote_versions.find(v=>v.version===q.current_version);return <div key={q.id}><p className="status-pill">{q.status==='accepted'?'Customer approval recorded':q.status==='sent'?'Awaiting customer agreement':q.status.replaceAll('_',' ')}</p><p>{v?.scope}</p><p><strong>{money(v?.labor_cents||0)}</strong> estimated labor · {(v?.duration_minutes||0)/60} hours</p>{q.status==='sent'&&<p>This estimate is saved in the CRM. Saving it did not email the customer.</p>}{canManage&&q.status==='sent'&&<form onSubmit={e=>{e.preventDefault();void act({command:'ApproveQuote',id:q.id,version:q.current_version,evidence:new FormData(e.currentTarget).get('evidence')});}}><label>How did the customer agree to this work and amount?<textarea name="evidence" required minLength={10} maxLength={2000} placeholder="For example: customer agreed by phone today to the listed work and amount."/></label><button disabled={busy}>Record customer agreement</button></form>}{canQuote&&q.status==='sent'&&<details><summary>Change the estimate before customer approval</summary><WorkflowQuoteForm request={request} busy={busy} submit={act}/></details>}</div>;})}
  </section>}
  {!invoices.some(i=>i.job_id===request.appointments.find(a=>a.status==='reserved')?.job_id)&&<ScheduledInvoice request={request} quotes={quotes} jobs={jobs} timezone={timezone}/>}
  {jobs.map(j=>{const hasInvoice=invoices.some(i=>i.job_id===j.id);const q=quotes.find(q=>q.id===j.quote_id),v=q?.quote_versions.find(v=>v.version===q.current_version);return <section className="workflow-section" key={j.id}><h3>Work & invoice</h3><p><strong>{j.status==='completed'?'Work completed':j.status==='working'?'Work in progress':j.status==='paused'?'Work paused':j.status==='canceled'?'Work canceled':'Ready to start'}</strong></p>
   {canWork&&next.action!=='schedule'&&<div className="actions">{['approved','scheduled','en_route','arrived'].includes(j.status)&&<button disabled={busy} onClick={()=>void fieldAction(j,'start')}>Start work timer</button>}{j.status==='working'&&<button disabled={busy} onClick={()=>void fieldAction(j,'pause')}>Pause work</button>}{j.status==='paused'&&<button disabled={busy} onClick={()=>void fieldAction(j,'resume')}>Resume work</button>}</div>}
   {canManage&&!hasInvoice&&['working','paused','completed'].includes(j.status)&&<InvoiceDraft organization={organization} job={j.id} revision={j.revision} completed={j.status==='completed'} blocked={busy} onBusy={onBusy} saved={onChanged} initialExpanded suggestedWork={v?{description:v.scope,chargedCents:v.labor_cents}:undefined}/>}
   {canManage&&['working','paused'].includes(j.status)&&<button disabled={busy} onClick={()=>void act({command:'CompleteServiceCall',id:j.id,revision:j.revision})}>Finish work & review invoice</button>}
   {!hasInvoice&&j.status==='completed'&&<p>No invoice has been issued yet. Review the draft above to continue.</p>}
  </section>;})}
  {invoices.map(i=><section className="workflow-section" key={i.id}><h3>Invoice {invoiceNumber(i.number)}</h3><p>Total <strong>{money(i.total_cents)}</strong> · paid {money(i.payments.reduce((n,p)=>n+p.cents,0))}</p><a className="button secondary" href={'/invoice?'+new URLSearchParams({organization,invoice:i.id,request:request.id})}>Open invoice / download PDF</a>{canManage&&<InvoiceDelivery organization={organization} invoice={i.id}/>}<InvoicePayments organization={organization} invoice={i.id} totalCents={i.total_cents} timezone={timezone} onChanged={onChanged}/></section>)}
 </section>;
}
function WorkflowQuoteForm({request,busy,submit}:{request:InboxRequest;busy:boolean;submit:(value:Record<string,unknown>)=>Promise<unknown>}){
 const [community,setCommunity]=useState(request.original_submission.communityRate==='Yes');
 return <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void submit({command:'PublishQuote',id:request.id,revision:request.revision,scope:f.get('scope'),minutes:Number(f.get('minutes')),community,eligibilityReviewed:community&&f.get('reviewed')==='on',customerId:null});}}><fieldset disabled={busy}>
  <legend>Prepare the work and labor estimate</legend><label>Work included<textarea name="scope" minLength={10} maxLength={5000} required defaultValue={[...requestTasks(request.original_submission).map(s=>s.task||s.service),request.original_submission.description||''].filter(Boolean).join('\n')}/></label>
  <label>Estimated work time<select name="minutes" defaultValue="120">{[120,150,180,210,240,300,360,420,480].map(n=><option key={n} value={n}>{n/60} hours</option>)}</select></label>
  <label className="check"><input type="checkbox" name="community" checked={community} onChange={e=>setCommunity(e.target.checked)}/>Use the Community Rate</label>{community&&<label className="check"><input type="checkbox" name="reviewed" required/>I reviewed the customer’s Community Rate request.</label>}
  <button>Save labor estimate</button><p className="tiny">Discuss the saved amount with the customer, then record their agreement. Separate materials and extra charges require their approval.</p>
 </fieldset></form>;
}
