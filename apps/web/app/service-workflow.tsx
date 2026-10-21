'use client';
import {creditTotal} from '../lib/invoice-credit-contract';

import {submissionAddress} from '../lib/request-inbox';
import {useState,useRef,useEffect} from 'react';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from '../lib/request-inbox';
import {requestTasks,requestTiming,visitState} from '../lib/request-inbox';
import {mobileWorkflow,mobilePhases,availableMobilePhases,type MobilePhase} from '../lib/mobile-workflow';
import {prepareFieldBrief} from '../lib/field-preparation';
import {prepareAgentPlan,prepareCustomerFollowUp} from '../lib/field-agent-plan';
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
import CustomerPicker from './customer-picker';
import OnSiteExtraReview from './on-site-extra-review';
import UnforeseenJobReview from './unforeseen-job-review';
import {hiddenConditionPreflight} from '../lib/unforeseen-job-cost';
type Job=LinkedJob;
const money=(n:number)=>(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function ServiceWorkflow({organization,request,quotes,jobs,invoices,timezone,canManage,canQuote,canWork,busy,onBusy,onReview,act,fieldAction,onChanged,onCustomer}:{organization:string;request:InboxRequest;quotes:LinkedQuote[];jobs:Job[];invoices:LinkedInvoice[];timezone:string;canManage:boolean;canQuote:boolean;canWork:boolean;busy:boolean;onBusy:(v:boolean)=>void;onReview:()=>void;act:(value:Record<string,unknown>)=>Promise<unknown>;fieldAction:(job:Job,action:'start'|'pause'|'resume')=>Promise<void>;onChanged:()=>void;onCustomer?:(id:string)=>void}){
 const plan=mobileWorkflow(request,quotes,jobs,invoices),next=plan.next,timing=requestTiming(request,timezone),{canLeave}=useEntrySafety();
 const fieldBrief=prepareFieldBrief(request,quotes,jobs,invoices);
 const agentTasks=prepareAgentPlan(request,quotes,jobs,invoices);
 const followUpDraft=prepareCustomerFollowUp(request);
 const [selection,setSelection]=useState<{phase:MobilePhase;state:string}|null>(null),[scheduleOpen,setScheduleOpen]=useState(false),[declineOpen,setDeclineOpen]=useState(false);
 const [childBusy,setChildBusy]=useState<Record<string,boolean>>({}),callbacks=useRef(new Map<string,(v:boolean)=>void>());
 const blocked=busy||Object.values(childBusy).some(Boolean);
 useEffect(()=>{onBusy(Object.values(childBusy).some(Boolean));return()=>onBusy(false);},[childBusy,onBusy]);
 function busyFor(id:string){if(!callbacks.current.has(id))callbacks.current.set(id,value=>setChildBusy(previous=>previous[id]===value?previous:{...previous,[id]:value}));return callbacks.current.get(id)!;}
 const transition=useRef(false),stateKey=JSON.stringify([request.revision,jobs.map(j=>[j.id,j.revision,j.status]),invoices.map(i=>[i.id,i.payments])]);
 // The workflow is progressive: future actions are not offered before their
 // canonical appointment/work/invoice prerequisites exist.
 const confirmedVisit=request.appointments.some(a=>visitState(a)==='reserved');
 const hasWork=jobs.some(j=>j.status!=='canceled');
 const hasInvoice=invoices.length>0;
 const allowedPhases=availableMobilePhases(request,jobs,invoices);
 const requestedPhase=selection?.state===stateKey?selection.phase:plan.phase;
 const phase=allowedPhases.includes(requestedPhase)?requestedPhase:allowedPhases[allowedPhases.length-1];
 const proposal=request.appointments.find(a=>visitState(a)==='proposal');
 async function prepareQuote(value:Record<string,unknown>){
  if(transition.current||busy)return;transition.current=true;
  try{let revision=request.revision;if(request.status==='submitted'){const r=await act({command:'ReviewRequest',id:request.id,revision,status:'reviewing'}) as {ok?:boolean;result?:{revision?:number}}|undefined;if(!r?.ok||!Number.isInteger(r.result?.revision))return;revision=r.result!.revision!;}return await act({...value,revision});}
  finally{transition.current=false;}
 }
 function openSchedule(){if(blocked||!canLeave())return;setScheduleOpen(true);}


 return <section className="card service-workflow" aria-label={'Service workflow for '+request.original_submission.name}>
  <header className="workflow-header"><p className="eyebrow">Current job</p><h2>{request.original_submission.name}</h2><details className="workflow-supporting"><summary>Service address</summary><p>{submissionAddress(request.original_submission)}</p></details><p className="workflow-service-summary">{requestTasks(request.original_submission).slice(0,2).map(t=>t.task||t.service).join(" · ")}{requestTasks(request.original_submission).length>2?` · +${requestTasks(request.original_submission).length-2} more`:""}</p><div className="actions"><a className="button secondary" href={'tel:'+request.original_submission.phone}><Icon name="phone"/>Call</a><a className="button secondary" href={navigationUrl(submissionAddress(request.original_submission))||undefined} target="_blank" rel="noreferrer"><Icon name="pin"/>Directions</a></div></header>
  <details className="workflow-supporting"><summary>Customer files and contacts</summary>
  {canManage&&request.customer_id&&onCustomer&&<p><button type="button" className="secondary" disabled={blocked} onClick={()=>onCustomer(request.customer_id!)}>Customer record & current contacts</button><span className="tiny"> Visit details above are from the original request.</span></p>}
  {canManage&&request.customer_id&&jobs.length>0&&<RelatedCustomerFiles key={organization+':'+request.customer_id} organization={organization} customer={request.customer_id} targets={[...jobs.map(j=>({kind:'job' as const,id:j.id})),...invoices.map(i=>({kind:'invoice' as const,id:i.id}))]} disabled={blocked} onManage={onCustomer?()=>onCustomer(request.customer_id!):undefined}/>}
  </details>
  {allowedPhases.length>1&&<details className="workflow-supporting workflow-other-steps"><summary>Other steps</summary><nav className="mobile-workflow-steps" aria-label="Available service steps">{mobilePhases.filter(p=>allowedPhases.includes(p.id)).map(p=><button type="button" key={p.id} className={phase===p.id?'is-current':''} aria-current={phase===p.id?'step':undefined} disabled={blocked} onClick={()=>{if(p.id===phase||canLeave())setSelection({phase:p.id,state:stateKey});}}><Icon name={p.icon}/><span>{p.label}</span></button>)}</nav></details>}
  <div className="workflow-next field-cockpit-next" role="status"><span className="eyebrow">Your next action</span><strong>{next.title}</strong><div className="actions">{phase==='visit'&&!confirmedVisit&&next.step>0&&<button type="button" disabled={blocked} onClick={openSchedule}>Confirm or choose time</button>}{phase==='work'&&jobs.filter(j=>!invoices.some(i=>i.job_id===j.id)).map(j=><span key={j.id}>{canWork&&['approved','scheduled','en_route','arrived'].includes(j.status)&&<button type="button" disabled={blocked} onClick={()=>void fieldAction(j,'start')}>Start job</button>}{canWork&&j.status==='working'&&<button type="button" disabled={blocked} onClick={()=>void fieldAction(j,'pause')}>Pause job</button>}{canWork&&j.status==='paused'&&<button type="button" disabled={blocked} onClick={()=>void fieldAction(j,'resume')}>Resume job</button>}</span>)}</div></div>
  <details className="workflow-field-brief workflow-secondary-panel" aria-label="Prepared field brief"><summary>Job preparation & follow-up drafts</summary><div>{agentTasks.length>0&&<div className="workflow-agent-task"><strong>Prepared next decision</strong><p>{agentTasks[0].title}</p><p className="tiny">{agentTasks[0].detail}</p><span className="tiny">Awaiting your review · no action sent</span></div>}{followUpDraft&&<details className="workflow-agent-draft"><summary>Prepared customer follow-up · not sent</summary><p>{followUpDraft.subject}</p><textarea aria-label="Review suggested customer follow-up" readOnly rows={6} value={followUpDraft.body}/><p className="tiny">Draft only. Review and send through the approved customer-message workflow.</p></details>}<strong>Prepared for you</strong><p>{fieldBrief.services.join(" · ")}{fieldBrief.extraServices?` · +${fieldBrief.extraServices} more`:""}</p>{fieldBrief.notes.length>0&&<details><summary>{fieldBrief.notes.length} check{fieldBrief.notes.length===1?"":"s"} before continuing</summary><ul>{fieldBrief.notes.map(n=><li key={n}>{n}</li>)}</ul></details>}</div></details>
  <section className="workflow-visit-overview" aria-label="Appointment at a glance">{request.appointments.some(a=>['reserved','proposal','needs_review'].includes(visitState(a)))?<div className="workflow-job-context">{request.appointments.filter(a=>['reserved','proposal','needs_review'].includes(visitState(a))).slice(0,1).map(a=><p className="field-visit-line" key={a.id}><strong>{visitState(a)==='reserved'?'Confirmed':'Proposed'}</strong> · {new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(a.arrival_at||a.start_at))}<details><summary>Appointment details</summary><AppointmentSummary visit={a} timezone={timezone}/></details></p>)}</div>:<p>{timing.label}: <strong>{timing.text}</strong></p>}</section>
  {request.original_submission.description&&<details className="workflow-customer-note" open={phase==='visit'}><summary>Customer’s note <span>Read before confirming or starting work</span></summary><p>{request.original_submission.description}</p></details>}
  {confirmedVisit&&<details className="workflow-supporting"><summary>Upcoming invoice preview</summary><ScheduledInvoice compact request={{...request,appointments:request.appointments.filter(a=>!a.job_id||!invoices.some(i=>i.job_id===a.job_id))}} quotes={quotes} jobs={jobs} timezone={timezone}/></details>} 
  {phase==='visit'&&<>
  {next.step>0&&<section className="workflow-section workflow-appointment-actions"><h3>Manage appointment</h3><button type="button" className="secondary" disabled={blocked} onClick={()=>void openSchedule()}>{!confirmedVisit?'Confirm appointment':next.action==='schedule'?'Choose or confirm a time':'Change appointment'}</button>{canManage&&!confirmedVisit&&!['declined','canceled'].includes(request.status)&&<button type="button" className="danger-ghost" disabled={blocked} onClick={()=>{if(canLeave())setDeclineOpen(true);}}>Decline request</button>}{scheduleOpen&&<SchedulingReviewPanel key={proposal?.id||request.id} organization={organization} requestId={request.id} appointmentId={proposal?.id||null} initialExpanded initialStart={request.original_submission.preferredTime} onBusy={busyFor('schedule')} completed={()=>{setScheduleOpen(false);onChanged();}}/>}</section>}
  {confirmedVisit&&next.step>0&&<section className="workflow-section"><h3>Scope & price</h3>
   {canManage&&requestTasks(request.original_submission).map((task,i)=>{const review=hiddenConditionPreflight(task.service,task.task);return review&&<details key={i} className="note"><summary>Before quoting {task.task||task.service}: {review.title}</summary>{review.hold&&<p role="alert">Do not promise this work without verified licensing and service scope.</p>}<ul>{review.questions.map(q=><li key={q}>{q}</li>)}</ul></details>;})}
   {!quotes.length&&<><p>Save the work and estimated labor amount. Nothing is emailed or approved automatically.</p>{canQuote&&['submitted','reviewing'].includes(request.status)&&<WorkflowQuoteForm request={request} busy={blocked} submit={prepareQuote} organization={organization} canLink={canManage}/>}</>}
   {quotes.map(q=>{const v=q.quote_versions.find(v=>v.version===q.current_version);return <div key={q.id}><p className="status-pill">{q.status==='accepted'?'Customer approval recorded':q.status==='sent'?'Awaiting customer agreement':q.status.replaceAll('_',' ')}</p><p>{v?.scope}</p><p><strong>{money(v?.labor_cents||0)}</strong> estimated labor · {(v?.duration_minutes||0)/60} hours</p>{q.status==='sent'&&<p>This estimate is saved in the CRM. Saving it did not email the customer.</p>}{canManage&&q.status==='sent'&&<form onSubmit={e=>{e.preventDefault();void act({command:'ApproveQuote',id:q.id,version:q.current_version,evidence:new FormData(e.currentTarget).get('evidence')});}}><label>How did the customer agree to this work and amount?<textarea name="evidence" required minLength={10} maxLength={2000} placeholder="For example: customer agreed by phone today to the listed work and amount."/></label><button disabled={blocked}>Record customer agreement</button></form>}{canQuote&&q.status==='sent'&&<details><summary>Change the estimate before customer approval</summary><WorkflowQuoteForm request={request} busy={blocked} submit={act} organization={organization} canLink={false}/></details>}</div>;})}
  </section>}
  </>}
  {canManage&&phase==='work'&&<details className="workflow-supporting"><summary>Extra work or unexpected conditions</summary><OnSiteExtraReview /><UnforeseenJobReview /></details>}
  {(phase==='work'||phase==='invoice')&&jobs.filter(j=>j.status!=='canceled'&&!invoices.some(i=>i.job_id===j.id)).length===0&&<p>Confirm the appointment, scope and price in step 1 before recording work.</p>}
  {(phase==='work'||phase==='invoice')&&jobs.filter(j=>j.status!=='canceled'&&!invoices.some(i=>i.job_id===j.id)).map(j=>{const hasInvoice=invoices.some(i=>i.job_id===j.id);const q=quotes.find(q=>q.id===j.quote_id),v=q?.quote_versions.find(v=>v.version===(j.approved_version??q.current_version));return <section className="workflow-section" key={j.id}><h3>Work & invoice</h3><p><strong>{j.status==='completed'?'Work completed':j.status==='working'?'Work in progress':j.status==='paused'?'Work paused':j.status==='canceled'?'Work canceled':'Ready to start'}</strong></p>
   {canWork&&next.action!=='schedule'&&<div className="actions">{['approved','scheduled','en_route','arrived'].includes(j.status)&&<button disabled={blocked} onClick={()=>void fieldAction(j,'start')}>Start work timer</button>}{j.status==='working'&&<button disabled={blocked} onClick={()=>void fieldAction(j,'pause')}>Pause work</button>}{j.status==='paused'&&<button disabled={blocked} onClick={()=>void fieldAction(j,'resume')}>Resume work</button>}</div>}
   {canManage&&!hasInvoice&&['working','paused','completed'].includes(j.status)&&<InvoiceDraft mobile completeOnSave={j.status!=='completed'} organization={organization} job={j.id} revision={j.revision} completed={j.status==='completed'} blocked={blocked} onBusy={busyFor('work:'+j.id)} saved={onChanged} suggestedWork={v?{description:v.scope,chargedCents:v.labor_cents}:undefined}/>}
   {!hasInvoice&&j.status==='completed'&&<p>No invoice has been issued yet. Review the draft above to continue.</p>}
  </section>;})}
  {phase==='closeout'&&!invoices.length&&<p>Issue the reviewed invoice in step 3 before recording payment.</p>}
  {phase==='closeout'&&invoices.map(i=><section className="workflow-section" key={i.id}><h3>Invoice {invoiceNumber(i.number)}</h3><p>Total <strong>{money(i.total_cents)}</strong> · paid {money(i.payments.reduce((n,p)=>n+p.cents,0))} · credits {money(creditTotal(i.credits))}</p><a className="button secondary" href={'/invoice?'+new URLSearchParams({organization,invoice:i.id,request:request.id})}>Open invoice / download PDF</a>{canManage&&<InvoiceDelivery onBusy={busyFor('email:'+i.id)} organization={organization} invoice={i.id}/>}<InvoicePayments guided onBusy={busyFor('payment:'+i.id)} organization={organization} invoice={i.id} totalCents={i.total_cents} timezone={timezone} onChanged={onChanged}/></section>)}
  {phase==='closeout'&&plan.settled&&<div className="workflow-closeout" role="status"><Icon name="check"/><h3>Visit closed out</h3><p>Work, invoices and confirmed receipts are saved. No balance remains.</p></div>}
  {declineOpen&&<RequestDetail organization={organization} requestId={request.id} timezone={timezone} canManage={canManage} initialPanel="decline" onClose={()=>setDeclineOpen(false)} onChanged={onChanged} onWork={()=>{setDeclineOpen(false);onChanged();}}/>}
  <details className="workflow-history"><summary>Request, appointment & agreement details</summary><button type="button" className="secondary" disabled={blocked} onClick={onReview}>Open full request</button>{request.appointments.filter(a=>visitState(a)==='reserved').map(a=><AppointmentSummary key={a.id} visit={a} timezone={timezone}/>)}{quotes.map(q=><p key={q.id}>Scope & price: {q.status.replaceAll('_',' ')} · {q.quote_versions.find(v=>v.version===q.current_version)?.scope}</p>)}</details>
 </section>;
}
function WorkflowQuoteForm({request,busy,submit,organization,canLink}:{request:InboxRequest;busy:boolean;submit:(value:Record<string,unknown>)=>Promise<unknown>;organization:string;canLink:boolean}){
 const [community,setCommunity]=useState(request.original_submission.communityRate==='Yes');
 const [dirty,setDirty]=useState(false);useUnsavedEntry('quote:'+request.id,dirty);
 return <form onChangeCapture={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void submit({command:'PublishQuote',id:request.id,revision:request.revision,scope:f.get('scope'),minutes:Number(f.get('minutes')),community,eligibilityReviewed:community&&f.get('reviewed')==='on',customerId:f.get('customerId')||null}).then(result=>{if((result as {ok?:boolean}|undefined)?.ok)setDirty(false);});}}><fieldset disabled={busy}>
  <legend>Prepare the work and labor estimate</legend>{canLink&&!request.customer_id&&<CustomerPicker organization={organization} onChanged={()=>setDirty(true)}/>}<label>Work included<textarea name="scope" minLength={10} maxLength={5000} required defaultValue={[...requestTasks(request.original_submission).map(s=>s.task||s.service),request.original_submission.description||''].filter(Boolean).join('\n')}/></label>
  <label>Estimated work time<select name="minutes" defaultValue="120">{[120,150,180,210,240,300,360,420,480].map(n=><option key={n} value={n}>{n/60} hours</option>)}</select></label>
  <label className="check"><input type="checkbox" name="community" checked={community} onChange={e=>setCommunity(e.target.checked)}/>Use the Community Rate</label>{community&&<label className="check"><input type="checkbox" name="reviewed" required/>I reviewed the customer’s Community Rate request.</label>}
  <button>Save labor estimate</button><p className="tiny">Discuss the saved amount with the customer, then record their agreement. Separate materials and extra charges require their approval.</p>
 </fieldset></form>;
}
