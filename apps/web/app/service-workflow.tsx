'use client';
import {sessionFetch} from '../lib/session-fetch';
import JobRecordTabs from './job-record-tabs';
import {useJobClock} from './use-job-clock';
import JobClockDisplay from './job-clock-display';
import {makeCompanionContext,supportTaskLabels,type CompanionContext} from '../lib/job-companion';
import {useState,useRef,useEffect} from 'react';
import {hourlyCharge} from '../lib/invoice-billing';
import {creditTotal} from '../lib/invoice-credit-contract';
import {submissionAddress,requestTasks,requestTiming,visitState,type InboxRequest,type LinkedQuote,type LinkedJob,type LinkedInvoice} from '../lib/request-inbox';
import {fieldWorkflow} from '../lib/field-workflow';
import {prepareFieldBrief} from '../lib/field-preparation';
import RequestDetail from './request-detail';
import SchedulingReviewPanel from './scheduling-review-panel';
import Icon from './crm-icons';
import {navigationUrl} from '../lib/day-plan';
import {invoiceNumber} from '../lib/invoice-number';
import {OfficeFieldNotes} from './field-work';
import LeadAssignment from './lead-assignment';
import InvoiceDraft from './invoice-draft';
import TaskTimer from './task-timer';
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
export default function ServiceWorkflow({organization,request,quotes,jobs,invoices,timezone,canManage,canQuote,canWork,busy,onBusy,onReview,act,fieldAction,onChanged,onCustomer,onNetwork,companyName,officeTools=true}:{organization:string;request:InboxRequest;quotes:LinkedQuote[];jobs:Job[];invoices:LinkedInvoice[];timezone:string;canManage:boolean;canQuote:boolean;canWork:boolean;busy:boolean;onBusy:(v:boolean)=>void;onReview:()=>void;act:(value:Record<string,unknown>)=>Promise<unknown>;fieldAction:(job:Job,action:'start'|'pause'|'resume')=>Promise<boolean|void>;onChanged:()=>void;onCustomer?:(id:string)=>void;onNetwork?:(tasks:string[],context?:CompanionContext,initialView?:'learn'|'refer')=>void;companyName?:string;officeTools?:boolean}){
 useEffect(()=>{document.getElementById('job-title-'+request.id)?.focus({preventScroll:true});},[request.id]);
 const task=fieldWorkflow(request,quotes,jobs,invoices),{canLeave}=useEntrySafety();
 const prepared=prepareFieldBrief(request,quotes,jobs,invoices);
 const phasePanel=task.kind==='confirm'||task.kind==='agreement'?'plan':task.kind==='invoice'||task.kind==='payment'||task.kind==='settled'?'invoice':'work';
 const [panel,setPanel]=useState<'plan'|'work'|'invoice'|'details'>(phasePanel),lastPhase=useRef(task.kind);

 const [scheduleOpen,setScheduleOpen]=useState(task.kind==='confirm'),[declineOpen,setDeclineOpen]=useState(false),[workRecordOpen,setWorkRecordOpen]=useState(false);
 useEffect(()=>{if(lastPhase.current!==task.kind){lastPhase.current=task.kind;setPanel(workRecordOpen&&task.kind==='paused'?'invoice':phasePanel);}},[task.kind,phasePanel,workRecordOpen]);
 const workRecordRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{if(workRecordOpen&&workRecordRef.current){workRecordRef.current.scrollIntoView?.({behavior:'smooth',block:'start'});workRecordRef.current.focus?.({preventScroll:true});}},[workRecordOpen]);
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
 const clock=useJobClock(organization,j?.id||null,j?.revision||0);
 async function finishWork(){if(!j||blocked)return;setWorkRecordOpen(true);if(task.kind==='working'){const result=await fieldAction(j,'pause');if(result===false)setWorkRecordOpen(false);return;}setPanel('invoice');}
 async function prepareQuote(value:Record<string,unknown>){
  if(transition.current||busy)return;transition.current=true;
  try{let revision=request.revision;if(request.status==='submitted'){const r=await act({command:'ReviewRequest',id:request.id,revision,status:'reviewing'}) as {ok?:boolean;result?:{revision?:number}}|undefined;if(!r?.ok)return r;if(!Number.isInteger(r.result?.revision))return {ok:false,uncertain:true};revision=r.result!.revision!;}return await act({...value,revision});}
  finally{transition.current=false;}
 }
 function openSchedule(){if(blocked||!canLeave())return;setScheduleOpen(true);}
 const working=task.kind==='working'||task.kind==='paused';
 const agreedWork=(task.kind==='ready'||working)&&q?.status==='accepted'&&q.request_id===request.id?v:null;

 const paymentInvoices=invoices.filter(i=>i.total_cents-i.payments.reduce((sum,p)=>sum+p.cents,0)-creditTotal(i.credits)>0);
 const paymentTarget=paymentInvoices[0]?.id||invoices[0]?.id;
 const paymentSections=invoices.filter(i=>i.id===paymentTarget||paymentInvoices.some(unpaid=>unpaid.id===i.id));
 const orderedInvoices=[...paymentSections,...invoices.filter(i=>!paymentSections.some(p=>p.id===i.id))];
 const totalOutstanding=paymentInvoices.reduce((total,i)=>total+Math.max(0,i.total_cents-i.payments.reduce((sum,p)=>sum+p.cents,0)-creditTotal(i.credits)),0);
 const paymentBalanceNote='Based on saved records. Open an invoice to refresh and verify the latest balance before recording payment.';
 
 return <section className="service-workflow field-job job-record" aria-label={'Service workflow for '+request.original_submission.name}>
  <header className="job-record-header"><div><p className="job-record-kicker">{jobs.length?'Service job':'Website request'}</p><h1 id={'job-title-'+request.id} tabIndex={-1}>{request.original_submission.name}</h1><p>{submissionAddress(request.original_submission)}</p></div><div className="field-contact-actions"><a className="button secondary" href={'tel:'+request.original_submission.phone} aria-label="Call customer"><Icon name="phone"/>Call</a>{navigationUrl(submissionAddress(request.original_submission))&&<a className="button secondary" href={navigationUrl(submissionAddress(request.original_submission))!} target="_blank" rel="noopener noreferrer" aria-label={'Directions to '+request.original_submission.name}><Icon name="pin"/>Directions</a>}</div></header>
  <div className="job-record-summary"><span className="job-state" role="status"><i aria-hidden="true"/>{task.label}</span><span><Icon name="calendar"/>{timing.text}</span>{v&&<span>{money(v.labor_cents)} agreed labor</span>}{totalOutstanding>0&&<span>{money(totalOutstanding)} due</span>}</div>
  <JobRecordTabs id={request.id} panel={panel} onChange={setPanel} blocked={blocked}/>
  {decision.unknown&&<div className="note" role="alert"><p>The last action needs confirmation. Check its saved result before making another change.</p><button type="button" disabled={decision.busy} onClick={()=>void decision.run()}>Check saved action</button></div>}
  <div className="job-record-body">
  <section className="job-record-panel" id={'job-panel-'+request.id+'-plan'} role="tabpanel" aria-labelledby={'job-tab-'+request.id+'-plan'} hidden={panel!=='plan'}>
   <div className="job-panel-heading"><div><h3>Plan the visit</h3><p>{requestTasks(request.original_submission).map(t=>t.task||t.service).join(' · ')}</p></div>{canManage&&!confirmedVisit&&task.kind!=='closed'&&<button type="button" className="text-action" disabled={blocked} onClick={()=>{if(canLeave())setDeclineOpen(true);}}>Decline request</button>}</div>
   {request.original_submission.description&&<section className="job-customer-message"><h4>From the customer</h4><p>{request.original_submission.description}</p></section>}
   {scheduleOpen?<SchedulingReviewPanel key={proposal?.id||request.id} organization={organization} requestId={request.id} appointmentId={proposal?.id||null} initialExpanded initialStart={request.original_submission.preferredTime} onBusy={busyFor('schedule')} completed={()=>{setScheduleOpen(false);onChanged();}}/>:<section className="job-plan-appointment"><h4>{confirmedVisit?'Scheduled visit':'Appointment'}</h4><p>{timing.text}</p>{canManage&&<button type="button" className="secondary" disabled={blocked} onClick={openSchedule}>{proposal&&confirmedVisit?'Review requested time change':confirmedVisit?'Change appointment':'Choose appointment'}</button>}</section>}
   {proposal&&confirmedVisit&&<p className="note">A new time was requested. Original visit stays booked until you save the replacement.</p>}
  {(task.kind==='confirm'||task.kind==='agreement')&&<section className="workflow-section" id="field-customer-agreement" tabIndex={-1}><h3>Work &amp; estimate</h3>
   {canManage&&requestTasks(request.original_submission).map((task,i)=>{const review=hiddenConditionPreflight(task.service,task.task);return review&&<details key={i} className="note"><summary>Before quoting {task.task||task.service}: {review.title}</summary>{review.hold&&<p role="alert">Do not promise this work without verified licensing and service scope.</p>}<ul>{review.questions.map(q=><li key={q}>{q}</li>)}</ul></details>;})}
   {!quotes.length&&<><p>Start with the work you’ll do and the estimated labor amount.</p>{canQuote&&['submitted','reviewing'].includes(request.status)&&<WorkflowQuoteForm request={request} busy={blocked} submit={value=>decision.run(value).then(ok=>({ok}))} organization={organization} canLink={canManage}/>}</>}
   {quotes.map(q=>{const v=q.quote_versions.find(v=>v.version===q.current_version);return <div key={q.id}><p className="status-pill">{q.status==='accepted'?'Customer approval recorded':q.status==='sent'?'Awaiting customer agreement':q.status.replaceAll('_',' ')}</p><p>{v?.scope}</p><p><strong>{v?money(v.labor_cents):'Amount unavailable'}</strong> estimated labor · {(v?.duration_minutes||0)/60} hours</p>{q.status==='sent'&&<p>Review this estimate with the customer before recording approval.</p>}{canManage&&q.status==='sent'&&!v&&<div className="note" role="alert"><p>The saved estimate version cannot be verified. Do not record customer approval until the scope and price have been recovered.</p><button type="button" className="secondary" onClick={onReview}>Review estimate history</button></div>}{canManage&&q.status==='sent'&&v&&<CustomerAgreement key={q.id} quote={q} blocked={blocked} onReview={onReview} submit={value=>decision.run(value).then(ok=>({ok}))}/>}{canQuote&&q.status==='sent'&&<details><summary>Change the estimate before customer approval</summary><WorkflowQuoteForm request={request} busy={blocked} submit={value=>decision.run(value).then(ok=>({ok}))} organization={organization} canLink={false}/></details>}</div>;})}
  </section>}
   {!['confirm','agreement'].includes(task.kind)&&quotes.length>0&&<section className="job-plan-agreement"><h4>Work &amp; price</h4>{quotes.map(quote=>{const approvedJob=jobs.find(job=>job.quote_id===quote.id&&job.approved_version);const version=quote.quote_versions.find(item=>item.version===(quote.status==='accepted'&&approvedJob?.approved_version?approvedJob.approved_version:quote.current_version));return <article key={quote.id}><p>{version?.scope}</p><strong>{version?money(version.labor_cents):'Amount unavailable'}</strong><span> · {quote.status==='accepted'?'Customer agreement recorded':quote.status.replaceAll('_',' ')}</span></article>;})}</section>}
   {task.kind==='confirm'&&<p className="job-save-note">Saving the appointment confirms the requested time. Work and price stay on this job.</p>}
  </section>
  <section className="job-record-panel" id={'job-panel-'+request.id+'-work'} role="tabpanel" aria-labelledby={'job-tab-'+request.id+'-work'} hidden={panel!=='work'}>
   <div className="job-panel-heading" {...(agreedWork?{role:"region","aria-label":"Agreed work brief"}:{})}><div><h3>{agreedWork?'Agreed work':'Work'}</h3><p className="field-agreed-scope">{agreedWork?.scope||requestTasks(request.original_submission).map(t=>t.task||t.service).join(' · ')}</p>{agreedWork&&<small>{money(agreedWork.labor_cents)} agreed labor · {agreedWork.duration_minutes/60} hours · version {agreedWork.version}</small>}</div></div>
   <section className="field-task job-work-controls" aria-label="Current field action">{!working&&<h4>{task.kind==='ready'?'Ready when you are':task.kind==='settled'?'Job finished':'Visit status'}</h4>}
   {j&&<JobClockDisplay seconds={clock.seconds} running={task.kind==='working'} error={clock.error} onRefresh={clock.refresh}/>}
   {task.kind==='ready'&&<button type="button" disabled={blocked||!canWork||!j} onClick={()=>{if(j)void fieldAction(j,'start');}}>Start work<Icon name="arrow"/></button>}
   {working&&j&&<div className="field-command-actions"><button type="button" className="secondary" disabled={blocked||!canWork} onClick={()=>void fieldAction(j,task.kind==='working'?'pause':'resume')}>{task.kind==='working'?'Pause timer':'Resume timer'}</button>{canManage&&<button type="button" disabled={blocked} onClick={()=>void finishWork()}>Finish work<Icon name="arrow"/></button>}</div>}
   {(task.kind==='confirm'||task.kind==='agreement')&&<><p>{task.kind==='confirm'?'Schedule this visit first.':'Record the agreed work and price before starting.'}</p><button type="button" className="secondary" disabled={blocked} onClick={()=>setPanel('plan')}>Go to plan</button></>}
   {task.kind==='invoice'&&<><p>The visit is complete and ready to invoice.</p><button type="button" disabled={blocked} onClick={()=>setPanel('invoice')}>Review invoice</button></>}
   {(task.kind==='settled'||task.kind==='payment')&&<><p>{task.kind==='settled'?'Work is complete and the balance is settled.':'Work is complete. The invoice has an outstanding balance.'}</p><button type="button" className="secondary" onClick={()=>setPanel('invoice')}>View invoice</button></>}
   {task.kind==='review'&&<><p>The saved job needs attention before work can continue.</p><button type="button" className="secondary" disabled={blocked} onClick={onReview}>Review saved records</button></>}
   {task.kind==='closed'&&<p>This request is closed. Its records are retained in Details.</p>}
   </section>
   {j&&canManage&&<OfficeFieldNotes key={'work-notes:'+organization+':'+j.id} organization={organization} job={j.id}/>}
   {j&&canManage&&<details className="job-task-breakdown"><summary>Track individual tasks</summary><TaskTimer key={organization+':'+j.id} organization={organization} job={j.id} revision={j.revision} choices={requestTasks(request.original_submission).map(c=>({service:c.service,task:c.task||c.service}))} blocked={blocked} onChanged={onChanged}/></details>}
  </section>
  <section className="job-record-panel" id={'job-panel-'+request.id+'-invoice'} role="tabpanel" aria-labelledby={'job-tab-'+request.id+'-invoice'} hidden={panel!=='invoice'}>
   <div className="job-panel-heading"><div><h3>Invoice &amp; payment</h3><p>{task.kind==='settled'?'Paid and saved.':invoices.length?'Review the invoice and record money received.':'Review actual work and charges in one place.'}</p></div></div>
   {j&&canManage&&(working||task.kind==='invoice')?<div ref={workRecordRef} tabIndex={-1} className="field-work-record" id="field-invoice-draft"><InvoiceDraft key={j.id} streamlined trackedMinutes={panel==='invoice'&&clock.data&&clock.data.status!=='working'?Math.round(clock.seconds!/60):undefined} mobile initialExpanded completeOnSave={j.status!=='completed'} organization={organization} job={j.id} revision={j.revision} completed={j.status==='completed'} blocked={blocked} onBusy={busyFor('work:'+j.id)} saved={onChanged} suggestedWork={v?{description:v.scope,chargedCents:v.labor_cents}:undefined}/></div>:!invoices.length&&<section className="job-invoice-preview"><h4>Estimate carried forward</h4>{v?<><p>{v.scope}</p><strong>{money(v.labor_cents)}</strong><p>Actual work and charges will appear here when the visit is finished.</p></>:<><p>Save the work and price in Plan. The invoice will carry those details forward.</p><button type="button" className="secondary" onClick={()=>setPanel('plan')}>Go to plan</button></>}</section>}
  {task.kind==='payment'&&paymentInvoices.length>1&&<nav aria-label="Outstanding invoices">{paymentInvoices.map(i=><a key={i.id} href={i.id===paymentTarget?'#field-payment-record':'#field-payment-'+i.id}>Invoice {invoiceNumber(i.number)} · {money(i.total_cents-i.payments.reduce((n,p)=>n+p.cents,0)-creditTotal(i.credits))}</a>)}</nav>}
  {task.kind==='payment'&&totalOutstanding===0&&<p role="alert">Saved records show no remaining balance; refresh invoice details to resolve the discrepancy.</p>}
  {(task.kind==='payment'||task.kind==='settled')&&(task.kind==='payment'?orderedInvoices:invoices).map(i=><section className="field-invoice" id={i.id===paymentTarget?'field-payment-record':'field-payment-'+i.id} key={i.id}><h3>Invoice {invoiceNumber(i.number)}</h3><InvoicePayments streamlined guided onBusy={busyFor('payment:'+i.id)} organization={organization} invoice={i.id} totalCents={i.total_cents} timezone={timezone} onChanged={onChanged}/><details className="workflow-supporting"><summary>Email invoice & PDF</summary><a className="button secondary" href={'/invoice?'+new URLSearchParams({organization,invoice:i.id,request:request.id})}>Open invoice / download PDF</a>{canManage&&<InvoiceDelivery streamlined onBusy={busyFor('email:'+i.id)} organization={organization} invoice={i.id}/>}</details></section>)}
   {task.kind==='payment'&&<p className="tiny">{paymentBalanceNote}</p>}

  </section>
  <section className="job-record-panel job-record-details" id={'job-panel-'+request.id+'-details'} role="tabpanel" aria-labelledby={'job-tab-'+request.id+'-details'} hidden={panel!=='details'}>
  {canManage&&officeTools&&<LeadAssignment key={'assignment:'+organization+':'+request.id} organization={organization} request={request.id}/>}
  <details className="field-job-progress"><summary>Preparation & safety</summary>
  {prepared.preparedActions.length>0&&<details className="field-prepared-actions" aria-label="Prepared administrative actions"><summary>Suggested next actions · {prepared.preparedActions.length} {prepared.preparedActions.length===1?'item':'items'}</summary><ul>{prepared.preparedActions.map((action,i)=><li key={i}>{action.label} <button type="button" className="secondary" disabled={blocked} onClick={()=>{if(action.action==='schedule'){setPanel('plan');openSchedule();}else if(action.action==='invoice'||action.action==='payment')setPanel('invoice');else if(action.action==='agreement'&&task.kind==='agreement')setPanel('plan');else onReview();}}>{action.action==='schedule'?'Review appointment':action.action==='invoice'?'Review invoice':action.action==='payment'?'Review payments':action.action==='agreement'&&task.kind==='agreement'?'Review work & price':'Open request'}</button></li>)}</ul><p className="tiny">Review each item before saving.</p></details>}
  {prepared.notes.length>0&&<details className="note field-auto-preparation" aria-label="Prepared job checks"><summary>Review service notes</summary><ul>{prepared.notes.map((note,i)=><li key={i}>{note}</li>)}</ul></details>}
</details>

  {canManage&&onNetwork&&<p><button type="button" className="secondary" disabled={blocked} onClick={()=>onNetwork(supportTaskLabels(requestTasks(request.original_submission)),makeCompanionContext({request:request.id,customer:request.original_submission.name,phase:task.kind,next:task.next.title,company:companyName,email:request.original_submission.email}),'learn')}>Help with this job</button></p>}

  <details className="field-job-details"><summary>Job details & files</summary>
   {request.appointments.filter(a=>['reserved','proposal','needs_review'].includes(visitState(a))).map(a=><AppointmentSummary key={a.id} visit={a} timezone={timezone}/>)}
   {canManage&&request.customer_id&&onCustomer&&<button type="button" className="secondary" disabled={blocked} onClick={()=>onCustomer(request.customer_id!)}>Customer record & current contacts</button>}
   {canManage&&request.customer_id&&jobs.length>0&&<RelatedCustomerFiles key={organization+':'+request.customer_id} organization={organization} customer={request.customer_id} targets={[...jobs.map(j=>({kind:'job' as const,id:j.id})),...invoices.map(i=>({kind:'invoice' as const,id:i.id}))]} disabled={blocked} onManage={onCustomer?()=>onCustomer(request.customer_id!):undefined}/>}
   {canManage&&confirmedVisit&&<button type="button" className="secondary" disabled={blocked} onClick={openSchedule}>Change appointment</button>}
   {confirmedVisit&&!invoices.length&&<details className="workflow-supporting"><summary>Upcoming invoice preview</summary><ScheduledInvoice compact request={request} quotes={quotes} jobs={jobs} timezone={timezone}/></details>}
   {canManage&&(working||task.kind==='ready')&&<details className="workflow-supporting"><summary>Extra work or unexpected conditions</summary><OnSiteExtraReview/><UnforeseenJobReview/></details>}
  </details>
  <details className="workflow-history"><summary>Request history & agreements</summary><button type="button" className="secondary" disabled={blocked} onClick={onReview}>Open full request</button>{quotes.map(q=><p key={q.id}>Scope & price: {q.status.replaceAll('_',' ')} · {q.quote_versions.find(v=>v.version===q.current_version)?.scope}</p>)}{invoices.map(i=><p key={i.id}>Invoice {invoiceNumber(i.number)} · {money(i.total_cents)} · received {money(i.payments.reduce((sum,p)=>sum+p.cents,0))} · credits {money(creditTotal(i.credits))}</p>)}</details>
  </section></div>
  {declineOpen&&<RequestDetail onNetwork={onNetwork} companyName={companyName} organization={organization} requestId={request.id} timezone={timezone} canManage={canManage} initialPanel="decline" onClose={()=>setDeclineOpen(false)} onChanged={onChanged} onWork={()=>{setDeclineOpen(false);onChanged();}}/>}
 </section>;
}

function WorkflowQuoteForm({request,busy,submit,organization,canLink}:{request:InboxRequest;busy:boolean;submit:(value:Record<string,unknown>)=>Promise<unknown>;organization:string;canLink:boolean}){
 const [community,setCommunity]=useState(false),[minutes,setMinutes]=useState(120),[people,setPeople]=useState(1),[rates,setRates]=useState<{standard:number;community:number}|null>(null);
 useEffect(()=>{let active=true;const controller=new AbortController();void sessionFetch('/api/configuration?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)return;const data=await response.json(),hourly=data.configuration?.settings?.hourly;if(active&&Number.isSafeInteger(hourly?.standardCents)&&hourly.standardCents>0&&hourly.standardCents<=999999999&&Number.isSafeInteger(hourly?.communityCents)&&hourly.communityCents>0&&hourly.communityCents<=999999999)setRates({standard:hourly.standardCents,community:hourly.communityCents});}).catch(()=>{});return()=>{active=false;controller.abort();};},[organization]);
 const estimate=rates?hourlyCharge(minutes,community?rates.community:rates.standard)*people:null;
 const [dirty,setDirty]=useState(false);useUnsavedEntry('quote:'+request.id,dirty);
 return <form onChangeCapture={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void submit({command:'PublishQuote',id:request.id,revision:request.revision,scope:f.get('scope'),minutes:Number(f.get('minutes')),crewSize:Number(f.get('crewSize')),community,eligibilityReviewed:community,customerId:f.get('customerId')||null}).then(result=>{if((result as {ok?:boolean}|undefined)?.ok)setDirty(false);});}}><fieldset disabled={busy}>
  <legend>Work and labor estimate</legend>{canLink&&!request.customer_id&&<CustomerPicker organization={organization} onChanged={()=>setDirty(true)}/>}<label>Work included<textarea name="scope" minLength={10} maxLength={4500} required defaultValue={requestTasks(request.original_submission).map(s=>s.task||s.service).join('\n')}/></label>
  <details className="estimate-options"><summary>People &amp; rate options</summary><label>Planned people — owner planning<select name="crewSize" value={people} onChange={e=>setPeople(Number(e.target.value))}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} {n===1?'person':'people'}</option>)}</select></label><p className="tiny">Only the first person has a two-hour minimum. Additional people bill actual time. You manage staffing.</p>
  </details><label>Estimated work time<select name="minutes" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[120,150,180,210,240,300,360,420,480].map(n=><option key={n} value={n}>{n/60} hours</option>)}</select></label>
  {request.original_submission.communityRate==='Yes'&&<p className="request-rate-note">The customer asked about the Community Rate.</p>}<label className="check"><input type="checkbox" name="community" checked={community} onChange={e=>setCommunity(e.target.checked)}/>Apply Community Rate · eligibility checked</label>{estimate!==null&&estimate<=999999999&&<div className="job-estimate-amount"><span>Estimated labor</span><strong>{money(estimate)}</strong><small>{minutes/60} hours · {people} {people===1?'person':'people'}</small></div>}
  <button>Save labor estimate</button><p className="tiny">Save the estimate, then record the customer’s agreement to the saved work and price.</p>
 </fieldset></form>;
}

function CustomerAgreement({quote,blocked,onReview,submit}:{quote:LinkedQuote;blocked:boolean;onReview:()=>void;submit:(value:Record<string,unknown>)=>Promise<unknown>}){
 const [dirty,setDirty]=useState(false),[evidence,setEvidence]=useState('');
 const [attempted,setAttempted]=useState(false),[needsReview,setNeedsReview]=useState(false);
 const [draftVersion]=useState(quote.current_version);
 const versionChanged=draftVersion!==quote.current_version;
 useUnsavedEntry('agreement-evidence:'+quote.id+':'+draftVersion,dirty);
 function record(note:string){if(attempted||blocked||needsReview||versionChanged)return;setAttempted(true);void submit({command:'ApproveQuote',id:quote.id,version:draftVersion,evidence:note}).then(result=>{if((result as {ok?:boolean}|undefined)?.ok)setDirty(false);else setNeedsReview(true);}).catch(()=>setNeedsReview(true));}
 return <section className="job-agreement-record">
 {versionChanged&&<p className="note" role="alert">The estimate changed. Review the updated work and amount before recording agreement. <button type="button" className="secondary" onClick={onReview}>Review updated estimate</button></p>}
 {needsReview&&<p className="note" role="alert">Check the saved agreement before trying another action. <button type="button" className="secondary" onClick={onReview}>Check agreement</button></p>}
 <fieldset disabled={blocked||attempted||versionChanged||needsReview}><legend>Customer agreement</legend><p>Once the customer has accepted this work and amount, record how they agreed.</p><div className="agreement-methods">
 <button type="button" className="secondary" onClick={()=>record('Customer confirmed by phone that they accept the saved work and price.')}>Record phone agreement</button>
 <button type="button" className="secondary" onClick={()=>record('Customer confirmed in person that they accept the saved work and price.')}>Record in-person agreement</button>
 <button type="button" className="secondary" onClick={()=>record('Customer confirmed by text or email that they accept the saved work and price.')}>Record text or email agreement</button>
 </div><details><summary>Add a custom agreement note</summary><form onChangeCapture={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();record(evidence);}}><label>Agreement note<textarea name="evidence" required minLength={10} maxLength={2000} value={evidence} onChange={e=>{setEvidence(e.target.value);setDirty(true);}}/></label><button disabled={evidence.trim().length<10}>Record customer agreement</button></form></details></fieldset>
 </section>;

}
