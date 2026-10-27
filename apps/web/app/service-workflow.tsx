'use client';
import {useState,useRef,useEffect} from 'react';
import {creditTotal} from '../lib/invoice-credit-contract';
import {submissionAddress,requestTasks,requestTiming,visitState,type InboxRequest,type LinkedQuote,type LinkedJob,type LinkedInvoice} from '../lib/request-inbox';
import {fieldWorkflow} from '../lib/field-workflow';
import {prepareFieldBrief} from '../lib/field-preparation';
import RequestDetail from './request-detail';
import SchedulingReviewPanel from './scheduling-review-panel';
import Icon from './crm-icons';
import {navigationUrl} from '../lib/day-plan';
import {invoiceNumber} from '../lib/invoice-number';
import InvoiceDraft from './invoice-draft';
import AppointmentSummary from './appointment-summary';
import InvoiceDelivery from './invoice-delivery';
import InvoicePayments from './invoice-payments';
import RelatedCustomerFiles from './related-customer-files';
import ScheduledInvoice from './scheduled-invoice';
import {useEntrySafety,useUnsavedEntry} from './entry-safety';
import {useFieldCommand} from './use-field-command';
import CustomerPicker from './customer-picker';
import OnSiteExtraReview from './on-site-extra-review';
import UnforeseenJobReview from './unforeseen-job-review';
import {hiddenConditionPreflight} from '../lib/unforeseen-job-cost';
type Job=LinkedJob;
const money=(n:number)=>(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function ServiceWorkflow({organization,request,quotes,jobs,invoices,timezone,canManage,canQuote,canWork,busy,onBusy,onReview,act,fieldAction,onChanged,onCustomer}:{organization:string;request:InboxRequest;quotes:LinkedQuote[];jobs:Job[];invoices:LinkedInvoice[];timezone:string;canManage:boolean;canQuote:boolean;canWork:boolean;busy:boolean;onBusy:(v:boolean)=>void;onReview:()=>void;act:(value:Record<string,unknown>)=>Promise<unknown>;fieldAction:(job:Job,action:'start'|'pause'|'resume')=>Promise<void>;onChanged:()=>void;onCustomer?:(id:string)=>void}){
 const task=fieldWorkflow(request,quotes,jobs,invoices),{canLeave}=useEntrySafety();
 const prepared=prepareFieldBrief(request,quotes,jobs,invoices);
 const [scheduleOpen,setScheduleOpen]=useState(false),[declineOpen,setDeclineOpen]=useState(false),[workRecordOpen,setWorkRecordOpen]=useState(false);
 const [childBusy,setChildBusy]=useState<Record<string,boolean>>({}),callbacks=useRef(new Map<string,(v:boolean)=>void>());
 const decision=useFieldCommand('workflow:'+organization+':'+request.id,value=>value.command==='PublishQuote'?prepareQuote(value):act(value));
 const blocked=busy||decision.busy||decision.unknown||Object.values(childBusy).some(Boolean);
 useEffect(()=>{onBusy(decision.busy||decision.unknown||Object.values(childBusy).some(Boolean));return()=>onBusy(false);},[childBusy,onBusy,decision.busy,decision.unknown]);
 function busyFor(id:string){if(!callbacks.current.has(id))callbacks.current.set(id,value=>setChildBusy(previous=>previous[id]===value?previous:{...previous,[id]:value}));return callbacks.current.get(id)!;}
 const transition=useRef(false);
 const confirmedVisit=request.appointments.some(a=>visitState(a)==='reserved');
 const timing=requestTiming(confirmedVisit?{...request,appointments:request.appointments.filter(a=>visitState(a)==='reserved')}:request,timezone);
 const proposal=request.appointments.find(a=>visitState(a)==='proposal');
 const j=task.job,q=quotes.find(q=>q.id===j?.quote_id),v=q?.quote_versions.find(v=>v.version===(j?.approved_version??q.current_version));
 async function prepareQuote(value:Record<string,unknown>){
  if(transition.current||busy)return;transition.current=true;
  try{let revision=request.revision;if(request.status==='submitted'){const r=await act({command:'ReviewRequest',id:request.id,revision,status:'reviewing'}) as {ok?:boolean;result?:{revision?:number}}|undefined;if(!r?.ok)return r;if(!Number.isInteger(r.result?.revision))return {ok:false,uncertain:true};revision=r.result!.revision!;}return await act({...value,revision});}
  finally{transition.current=false;}
 }
 function openSchedule(){if(blocked||!canLeave())return;setScheduleOpen(true);}
 const working=task.kind==='working'||task.kind==='paused';
 const agreedWork=(task.kind==='ready'||working)&&q?.status==='accepted'&&q.request_id===request.id?v:null;
 const scopeCharacters=Array.from(agreedWork?.scope||'');
 const scopePreview=scopeCharacters.slice(0,240).join('');
 const paymentInvoices=invoices.filter(i=>i.total_cents-i.payments.reduce((sum,p)=>sum+p.cents,0)-creditTotal(i.credits)>0);
 const paymentTarget=paymentInvoices[0]?.id||invoices[0]?.id;
 return <section className="card service-workflow field-job" aria-label={'Service workflow for '+request.original_submission.name}>
  <header className="field-job-header"><div><h2>{request.original_submission.name}</h2><p>{submissionAddress(request.original_submission)}</p></div><div className="field-contact-actions"><a className="button secondary" href={'tel:'+request.original_submission.phone} aria-label="Call customer"><Icon name="phone"/>Call</a>{navigationUrl(submissionAddress(request.original_submission))&&<a className="button secondary" href={navigationUrl(submissionAddress(request.original_submission))!} target="_blank" rel="noopener noreferrer" aria-label={"Directions to "+request.original_submission.name}><Icon name="pin"/>Directions</a>}</div></header>
  {agreedWork?<section className="field-work-brief" aria-label="Agreed work brief"><h3>Agreed work</h3><p className="field-job-service">{scopePreview}{scopeCharacters.length>240?'…':''}</p>{scopeCharacters.length>240&&<details><summary>Read full agreed scope</summary><p className="field-agreed-scope">{agreedWork.scope}</p></details>}<dl><div><dt>Estimated time</dt><dd>{agreedWork.duration_minutes/60} hours</dd></div><div><dt>Labor estimate</dt><dd>{money(agreedWork.labor_cents)}</dd></div></dl><p className="tiny">Saved agreement · version {agreedWork.version}. Final charges are reviewed after work.</p></section>:<p className="field-job-service">{requestTasks(request.original_submission).map(t=>t.task||t.service).join(' · ')}</p>}
  <p className="field-job-time"><Icon name="calendar"/><strong>{timing.label}</strong> {timing.text}</p>
  <nav className="field-workflow-stages" aria-label="Job progress"><span aria-current={task.kind==='confirm'?'step':undefined}>Appointment</span><span aria-current={task.kind==='agreement'?'step':undefined}>Agreement</span><span aria-current={['ready','working','paused'].includes(task.kind)?'step':undefined}>Work</span><span aria-current={task.kind==='invoice'?'step':undefined}>Invoice</span><span aria-current={task.kind==='payment'?'step':undefined}>Payment</span><span aria-current={['settled','closed'].includes(task.kind)?'step':undefined}>History</span></nav>
  {prepared.notes.length>0&&<details className="note field-auto-preparation" aria-label="Prepared job checks"><summary><strong>Job check:</strong> {prepared.notes[0]}{prepared.notes.length>1&&<span> · {prepared.notes.length-1} more</span>}</summary>{prepared.notes.length>1&&<ul>{prepared.notes.slice(1).map((note,i)=><li key={i}>{note}</li>)}</ul>}</details>}
  {request.original_submission.description&&<details className="workflow-customer-note" open={task.kind==='confirm'||task.kind==='agreement'}><summary>Customer’s note</summary><p>{request.original_submission.description}</p></details>}
  {decision.unknown&&<div className="note" role="alert"><p>The last field decision is unconfirmed. Its original details are kept; check the saved result before editing or leaving.</p><button type="button" disabled={decision.busy} onClick={()=>void decision.run()}>Check saved field decision</button></div>}
  <section className="field-task" aria-label="Current field action"><h3>{task.label}</h3>
   {task.kind==='confirm'&&<><p>{task.next.detail}</p><div className="field-command-actions"><button type="button" disabled={blocked||!canManage} onClick={openSchedule}>Confirm appointment<Icon name="arrow"/></button>{canManage&&!confirmedVisit&&<button type="button" className="secondary" disabled={blocked} onClick={()=>{if(canLeave())setDeclineOpen(true);}}>Decline request</button>}</div></>}
   {task.kind==='ready'&&<button type="button" disabled={blocked||!canWork||!j} onClick={()=>{if(j)void fieldAction(j,'start');}}>Start work<Icon name="arrow"/></button>}
   {working&&j&&<div className="field-command-actions"><button type="button" disabled={blocked||!canWork} onClick={()=>void fieldAction(j,task.kind==='working'?'pause':'resume')}>{task.kind==='working'?'Pause timer':'Resume timer'}</button>{canManage&&!workRecordOpen&&<button type="button" className="secondary" disabled={blocked} onClick={()=>setWorkRecordOpen(true)}>Finish work<Icon name="arrow"/></button>}</div>}
   {task.kind==='invoice'&&j&&<><p>Work is recorded. Review the prepared charges before issuing an invoice.</p><a className="button" href="#field-invoice-draft">Review invoice details<Icon name="arrow"/></a></>}
   {task.kind==='payment'&&invoices.length>0&&<><p>Record only money actually received. Cash and Zelle payments can be entered below, including partial payments.</p><a className="button" href="#field-payment-record">Review payments<Icon name="arrow"/></a></>}
   {task.kind==='settled'&&<p role="status">All work is invoiced. Confirmed receipts and credits settle the balance. History is saved below.</p>}
   {task.kind==='closed'&&<p>The saved request and its history are retained.</p>}
  </section>
  {proposal&&confirmedVisit&&canManage&&<div className="note"><p>A different appointment time was requested. The confirmed visit stays booked.</p><button type="button" className="secondary" disabled={blocked} onClick={openSchedule}>Review requested time change</button></div>}
  {scheduleOpen&&<SchedulingReviewPanel key={proposal?.id||request.id} organization={organization} requestId={request.id} appointmentId={proposal?.id||null} initialExpanded initialStart={request.original_submission.preferredTime} onBusy={busyFor('schedule')} completed={()=>{setScheduleOpen(false);onChanged();}}/>}
  {task.kind==='agreement'&&<section className="workflow-section"><h3>Scope & price</h3>
   {canManage&&requestTasks(request.original_submission).map((task,i)=>{const review=hiddenConditionPreflight(task.service,task.task);return review&&<details key={i} className="note"><summary>Before quoting {task.task||task.service}: {review.title}</summary>{review.hold&&<p role="alert">Do not promise this work without verified licensing and service scope.</p>}<ul>{review.questions.map(q=><li key={q}>{q}</li>)}</ul></details>;})}
   {!quotes.length&&<><p>Save the work and estimated labor amount. Nothing is emailed or approved automatically.</p>{canQuote&&['submitted','reviewing'].includes(request.status)&&<WorkflowQuoteForm request={request} busy={blocked} submit={value=>decision.run(value).then(ok=>({ok}))} organization={organization} canLink={canManage}/>}</>}
   {quotes.map(q=>{const v=q.quote_versions.find(v=>v.version===q.current_version);return <div key={q.id}><p className="status-pill">{q.status==='accepted'?'Customer approval recorded':q.status==='sent'?'Awaiting customer agreement':q.status.replaceAll('_',' ')}</p><p>{v?.scope}</p><p><strong>{money(v?.labor_cents||0)}</strong> estimated labor · {(v?.duration_minutes||0)/60} hours</p>{q.status==='sent'&&<p>This estimate is saved in the CRM. Saving it did not email the customer.</p>}{canManage&&q.status==='sent'&&<CustomerAgreement key={q.id} quote={q} blocked={blocked} submit={value=>decision.run(value).then(ok=>({ok}))}/>}{canQuote&&q.status==='sent'&&<details><summary>Change the estimate before customer approval</summary><WorkflowQuoteForm request={request} busy={blocked} submit={value=>decision.run(value).then(ok=>({ok}))} organization={organization} canLink={false}/></details>}</div>;})}
  </section>}

  {j&&canManage&&(working||task.kind==='invoice')&&<div hidden={working&&!workRecordOpen} className="field-work-record" id="field-invoice-draft"><InvoiceDraft key={j.id} mobile initialExpanded={workRecordOpen||task.kind==='invoice'} completeOnSave={j.status!=='completed'} organization={organization} job={j.id} revision={j.revision} completed={j.status==='completed'} blocked={blocked} onBusy={busyFor('work:'+j.id)} saved={onChanged} suggestedWork={v?{description:v.scope,chargedCents:v.labor_cents}:undefined}/></div>}
  {(task.kind==='payment'||task.kind==='settled')&&invoices.map(i=><section className="field-invoice" id={i.id===paymentTarget?'field-payment-record':undefined} key={i.id}><h3>Invoice {invoiceNumber(i.number)}</h3><InvoicePayments guided onBusy={busyFor('payment:'+i.id)} organization={organization} invoice={i.id} totalCents={i.total_cents} timezone={timezone} onChanged={onChanged}/><details className="workflow-supporting"><summary>Email invoice & PDF</summary><a className="button secondary" href={'/invoice?'+new URLSearchParams({organization,invoice:i.id,request:request.id})}>Open invoice / download PDF</a>{canManage&&<InvoiceDelivery onBusy={busyFor('email:'+i.id)} organization={organization} invoice={i.id}/>}</details></section>)}
  <details className="field-job-details"><summary>Job details & files</summary>
   {request.appointments.filter(a=>['reserved','proposal','needs_review'].includes(visitState(a))).map(a=><AppointmentSummary key={a.id} visit={a} timezone={timezone}/>)}
   {canManage&&request.customer_id&&onCustomer&&<button type="button" className="secondary" disabled={blocked} onClick={()=>onCustomer(request.customer_id!)}>Customer record & current contacts</button>}
   {canManage&&request.customer_id&&jobs.length>0&&<RelatedCustomerFiles key={organization+':'+request.customer_id} organization={organization} customer={request.customer_id} targets={[...jobs.map(j=>({kind:'job' as const,id:j.id})),...invoices.map(i=>({kind:'invoice' as const,id:i.id}))]} disabled={blocked} onManage={onCustomer?()=>onCustomer(request.customer_id!):undefined}/>}
   {canManage&&confirmedVisit&&<button type="button" className="secondary" disabled={blocked} onClick={openSchedule}>Change appointment</button>}
   {confirmedVisit&&!invoices.length&&<details className="workflow-supporting"><summary>Upcoming invoice preview</summary><ScheduledInvoice compact request={request} quotes={quotes} jobs={jobs} timezone={timezone}/></details>}
   {canManage&&(working||task.kind==='ready')&&<details className="workflow-supporting"><summary>Extra work or unexpected conditions</summary><OnSiteExtraReview/><UnforeseenJobReview/></details>}
  </details>
  <details className="workflow-history"><summary>Request history & agreements</summary><button type="button" className="secondary" disabled={blocked} onClick={onReview}>Open full request</button>{quotes.map(q=><p key={q.id}>Scope & price: {q.status.replaceAll('_',' ')} · {q.quote_versions.find(v=>v.version===q.current_version)?.scope}</p>)}{invoices.map(i=><p key={i.id}>Invoice {invoiceNumber(i.number)} · {money(i.total_cents)} · received {money(i.payments.reduce((sum,p)=>sum+p.cents,0))} · credits {money(creditTotal(i.credits))}</p>)}</details>
  {declineOpen&&<RequestDetail organization={organization} requestId={request.id} timezone={timezone} canManage={canManage} initialPanel="decline" onClose={()=>setDeclineOpen(false)} onChanged={onChanged} onWork={()=>{setDeclineOpen(false);onChanged();}}/>}
 </section>;
}
function WorkflowQuoteForm({request,busy,submit,organization,canLink}:{request:InboxRequest;busy:boolean;submit:(value:Record<string,unknown>)=>Promise<unknown>;organization:string;canLink:boolean}){
 const [community,setCommunity]=useState(request.original_submission.communityRate==='Yes');
 const [dirty,setDirty]=useState(false);useUnsavedEntry('quote:'+request.id,dirty);
 return <form onChangeCapture={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void submit({command:'PublishQuote',id:request.id,revision:request.revision,scope:f.get('scope'),minutes:Number(f.get('minutes')),community,eligibilityReviewed:community&&f.get('reviewed')==='on',customerId:f.get('customerId')||null}).then(result=>{if((result as {ok?:boolean}|undefined)?.ok)setDirty(false);});}}><fieldset disabled={busy}>
  <legend>Prepare the work and labor estimate</legend>{canLink&&!request.customer_id&&<CustomerPicker organization={organization} onChanged={()=>setDirty(true)}/>}<label>Work included<textarea name="scope" minLength={10} maxLength={5000} required defaultValue={requestTasks(request.original_submission).map(s=>s.task||s.service).join('\n')}/></label>
  <label>Estimated work time<select name="minutes" defaultValue="120">{[120,150,180,210,240,300,360,420,480].map(n=><option key={n} value={n}>{n/60} hours</option>)}</select></label>
  <label className="check"><input type="checkbox" name="community" checked={community} onChange={e=>setCommunity(e.target.checked)}/>Use the Community Rate</label>{community&&<label className="check"><input type="checkbox" name="reviewed" required/>I reviewed the customer’s Community Rate request.</label>}
  <button>Save labor estimate</button><p className="tiny">Discuss the saved amount with the customer, then record their agreement. Separate materials and extra charges require their approval.</p>
 </fieldset></form>;
}

function CustomerAgreement({quote,blocked,submit}:{quote:LinkedQuote;blocked:boolean;submit:(value:Record<string,unknown>)=>Promise<unknown>}){
 const [dirty,setDirty]=useState(false);
 useUnsavedEntry('agreement-evidence:'+quote.id,dirty);
 return <form onChangeCapture={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();void submit({command:'ApproveQuote',id:quote.id,version:quote.current_version,evidence:new FormData(e.currentTarget).get('evidence')}).then(result=>{if((result as {ok?:boolean}|undefined)?.ok)setDirty(false);});}}>
 <fieldset disabled={blocked}><label>How did the customer agree to this work and amount?<textarea name="evidence" required minLength={10} maxLength={2000} placeholder="For example: customer agreed by phone today to the listed work and amount."/></label><button>Record customer agreement</button></fieldset></form>;
}
