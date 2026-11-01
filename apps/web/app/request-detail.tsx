'use client';
import {makeCompanionContext,supportTaskLabels,type CompanionContext} from '../lib/job-companion';
import {fieldWorkflow} from '../lib/field-workflow';
import {submissionAddress} from '../lib/request-inbox';
import AppointmentSummary from './appointment-summary';
import {serviceTone} from '../lib/month-calendar';
import ScheduledInvoice from './scheduled-invoice';
import {invoiceNumber} from "../lib/invoice-number";
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {requestStage,requestTasks,requestTiming,visitState,type InboxData} from '../lib/request-inbox';
import {navigationUrl} from '../lib/day-plan';
import Icon from './crm-icons';
import RequestReplyDraft from './request-reply-draft';
import PreparedCustomerReply from './prepared-customer-reply';
import {prepareCustomerFollowUp} from '../lib/field-agent-plan';
import {YNSG_ORGANIZATION} from '../lib/decline-message';
import {DeclineDecisionFields} from './decline-message-fields';
import SchedulingReviewPanel from './scheduling-review-panel';
import RecurringVisits from './recurring-visits';
import RelationshipNotes from './relationship-notes';
import {ownerRequestNextStep} from '../lib/service-workflow';
import {useBlockedEntry,useEntrySafety} from './entry-safety';
type Props={onNetwork?:(tasks:string[],context?:CompanionContext,initialView?:'learn'|'refer')=>void;companyName?:string;organization:string;requestId:string;timezone:string;canManage:boolean;onClose:()=>void;onChanged:()=>void;onWork:(requestId:string)=>void;initialPanel?:'overview'|'decline'|'schedule'};
export default function RequestDetail({organization,requestId,timezone,canManage,onClose,onChanged,onWork,onNetwork,companyName,initialPanel='overview'}:Props){
 const {canLeave}=useEntrySafety();
 const dialog=useRef<HTMLDialogElement>(null),keys=useRef(new Map<string,string>());
 const [data,setData]=useState<InboxData|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[reload,setReload]=useState(0);
 const frozen=useRef<{path:string;body:string}|null>(null),sending=useRef(false);
 const [loading,setLoading]=useState(true);
 useBlockedEntry('request-action:'+organization+':'+requestId,busy||unknown);
 const [panel,setPanel]=useState<'overview'|'schedule'|'decline'|'reschedule'|'cancel'>(initialPanel),[appointment,setAppointment]=useState<string|null|undefined>(undefined);
 useEffect(()=>{const el=dialog.current,returnFocus=document.activeElement;el?.showModal();return()=>{el?.close();if(returnFocus instanceof HTMLElement&&returnFocus.isConnected)returnFocus.focus();};},[]);
 useEffect(()=>{const controller=new AbortController();let live=true;setLoading(true);setError('');
  void sessionFetch('/api/request-inbox?'+new URLSearchParams({organization,request:requestId,filter:'all'}),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live)setData(d);}).catch(e=>{if(live&&!controller.signal.aborted)setError(publicError(e));}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;controller.abort();};
 },[organization,requestId,reload]);
 const request=data?.requests[0],submission=request?.original_submission;
 const active=request?.appointments.filter(a=>['proposal','reserved','needs_review'].includes(visitState(a)))||[];
 const proposal=active.find(a=>visitState(a)==='proposal'),confirmed=active.find(a=>a.status==='reserved');
 const stage=request?requestStage(request):null;
 const date=(v:string)=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
 async function sendFrozenCommand(){
  if(sending.current||!frozen.current)return false;
  sending.current=true;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await sessionFetch(frozen.current.path,{method:'POST',headers:{'Content-Type':'application/json'},body:frozen.current.body});
   if(response.status>=400&&response.status<500){
    const value=await response.json().catch(()=>null);
    if(unknown){setError('The earlier decision is still unconfirmed. Refresh the request or check the same saved action; do not issue a different decision.');return false;}
    frozen.current=null;
    setError(typeof value?.error==='string'?value.error:'The decision was rejected. Your request is unchanged.');
    return false;
   }
   if(!response.ok)throw Error('UNCONFIRMED');
   const value=await response.json();
   if(value?.ok!==true||value.result===null||value.result===undefined)throw Error('UNCONFIRMED');
   frozen.current=null;setUnknown(false);
   setMessage('Decision saved. Check Activity for the actual customer-message and calendar-delivery status.');
   setReload(n=>n+1);
   try{onChanged();}catch{setError('Decision saved, but the dashboard refresh failed. Refresh before the next action.');}
   return true;
  }catch{
   setUnknown(true);
   setError('We could not confirm whether that action saved. Your original decision is kept. Check the same saved action before making another change.');
   return false;
  }finally{sending.current=false;setBusy(false);}
 }
 async function command(path:string,input:Record<string,unknown>){
  if(busy||frozen.current||unknown)return false;
  if(loading||error)return false;
  const fingerprint=JSON.stringify([organization,path,input]);
  if(!keys.current.has(fingerprint))keys.current.set(fingerprint,crypto.randomUUID());
  frozen.current={path,body:JSON.stringify({organizationId:organization,key:keys.current.get(fingerprint),...input})};
  return sendFrozenCommand();
 }
 async function review(target:string|null){
  if(!request||locked)return;
  setAppointment(target);setPanel('schedule');
 }
 function changed(status:string,outcome?:string){setBusy(false);setPanel('overview');setMessage(outcome||(status==='reserved'?'Appointment booked. Check Activity for calendar and email delivery.':'Proposed time saved. Select Accept proposed time to confirm it.'));setReload(n=>n+1);onChanged();}
 async function decline(form:HTMLFormElement){
  if(!request)return;const f=new FormData(form),choice=String(f.get('choice'));
  if(proposal){if(await command('/api/scheduling',{schemaVersion:1,input:{action:choice,id:proposal.id,revision:proposal.revision,reason:f.get('reason')}})){if(choice==='decline_time'&&panel==='reschedule'){setAppointment(null);setPanel('schedule');}else setPanel('overview');}}
  else if(await command('/api/commands',{command:'ReviewRequest',id:request.id,revision:request.revision,status:'declined',reason:String(f.get('reason')||'')}))setPanel('overview');
 }
 const quotes=data?.quotes.filter(q=>q.request_id===requestId)||[];
 const quoteIds=new Set(quotes.map(q=>q.id)),jobs=data?.jobs.filter(j=>quoteIds.has(j.quote_id))||[],jobIds=new Set(jobs.map(j=>j.id)),invoices=data?.invoices.filter(i=>jobIds.has(i.job_id))||[];
 const locked=busy||unknown||loading||Boolean(error);
 const confirmedHistory=Boolean(confirmed);
 const openRequest=request&&!['declined','canceled'].includes(request.status);
 function close(){if(!busy&&!unknown&&canLeave())onClose();}
 function show(nextPanel:typeof panel){if(!busy&&!unknown&&canLeave())setPanel(nextPanel);}
 const next=request?ownerRequestNextStep(request,quotes,jobs,invoices):null;
 const preparedReply=request&&canManage&&!confirmed&&openRequest?prepareCustomerFollowUp(request):null;
 async function cancelVisit(form:HTMLFormElement){
  if(!confirmed)return;
  const reason=String(new FormData(form).get('reason')||'').trim();
  if(await command('/api/appointment-cancel',{id:confirmed.id,revision:confirmed.revision,reason})) {setPanel('overview');setMessage('Appointment canceled. The time is available again. The request and financial history are kept; the customer update is queued.');}
 }
 return <dialog className="request-dialog" ref={dialog} aria-labelledby="request-detail-title" onCancel={e=>{e.preventDefault();if(busy||unknown)return;close();}}>
  {canManage&&onNetwork&&<p><button className="secondary" disabled={busy||unknown} onClick={()=>{if(!request||!submission||!data)return;const next=fieldWorkflow(request,data.quotes,data.jobs,data.invoices);onNetwork(supportTaskLabels(requestTasks(submission)),makeCompanionContext({request:request.id,customer:submission.name,phase:next.kind,next:next.next.title,company:companyName,email:submission.email}));}}>Find a referral</button></p>}
  <header className="detail-top"><div><p className="eyebrow">Service request</p><h2 id="request-detail-title">{submission?.name||'Loading request…'}</h2>{stage&&<span className={'status-pill tone-'+stage.tone}>{stage.label}</span>}</div><button className="icon-button secondary" type="button" aria-label="Close request" disabled={busy||unknown} onClick={close}><Icon name="close"/></button></header>
  <div className="detail-body" aria-busy={loading}>
   {error&&<div className="error note" role="alert"><p>{error}</p>{data&&!unknown&&<button type="button" className="secondary" disabled={busy||loading} onClick={()=>setReload(n=>n+1)}>Refresh request</button>}</div>}{unknown&&<div className="note" role="group" aria-label="Unconfirmed owner action"><p>The previous action might already be saved. Do not make a new decision until this result is confirmed.</p><button type="button" disabled={busy} onClick={()=>void sendFrozenCommand()}>Check saved action result</button></div>}{message&&<p className="note" role="status">{message}</p>}
   {!data&&!error&&<div className="loading" role="status">Opening the complete request…</div>}
   {data&&!request&&<div className="empty-state"><h3>Request unavailable</h3><p>This request may belong to another business or no longer be available to your account.</p></div>}
   {request&&submission&&<>

     {data.preferences.filter(p=>p.request_id===requestId).map(p=><div className="note" key={p.id}><strong>Customer requested another time</strong><p>{p.preferred_local_start?.replace('T',' at ')} {p.preferred_local_start&&`(${p.timezone})`}</p><details><summary>Customer’s message</summary><p>{p.note}</p></details><small>Current visit remains booked.</small></div>)}
     <section className="detail-section"><div className="section-heading"><h3>Appointment</h3></div>
      {active.length?active.map(a=><AppointmentSummary key={a.id} visit={a} timezone={timezone}/>):<div className="empty-inline"><Icon name="calendar"/><div><small>{requestTiming(request,timezone).label}</small><p>{requestTiming(request,timezone).text}</p></div></div>}
      {confirmed&&<div className="request-next-step"><Icon name="arrow"/><div><span className="eyebrow">Next action</span><strong>{next?.title}</strong><p>{next?.detail}</p></div></div>}
      {canManage&&openRequest&&panel==='overview'&&<div className="decision-actions" aria-label="Next request action">
       {!confirmed?<><button type="button" disabled={locked} onClick={()=>void review(proposal?.id||null)}><Icon name="calendar"/>Confirm appointment</button><button type="button" className="danger-ghost" disabled={locked} onClick={()=>setPanel('decline')}>Decline request</button>{proposal&&<button type="button" className="secondary" disabled={locked} onClick={()=>setPanel('reschedule')}>Choose another time</button>}</>:<><button type="button" disabled={locked} onClick={()=>{if(canLeave())onWork(request.id);}}><Icon name={next?.action==='invoice'?'money':'work'}/>{next?.action==='invoice'?'Manage invoice & payment':next?.step===5?'Review work & prepare invoice':next?.step===3?(data.quotes.some(q=>q.status==='sent')?'Review & record approval':'Prepare work & price'):'Open work timer'}</button><button type="button" className="secondary" disabled={locked} onClick={()=>void review(proposal?.id||null)}>{proposal?'Review proposed replacement':'Reschedule appointment'}</button></>}
      </div>}
      {panel==='overview'&&{preparedReply&&submission.email&&<PreparedCustomerReply key={organization+':'+request.id+':'+request.revision} recipient={submission.email} draft={preparedReply}/>}}
      {canManage&&confirmed&&panel==='overview'&&!jobs.some(j=>['working','paused','completed'].includes(j.status))&&Date.parse(confirmed.end_at)>Date.now()&&<button type="button" className="danger-ghost" disabled={busy} onClick={()=>setPanel('cancel')}>Cancel this appointment</button>}
      {panel==='cancel'&&confirmed&&<form onSubmit={e=>{e.preventDefault();void cancelVisit(e.currentTarget);}} className="decision-form"><h4>Cancel the confirmed appointment</h4><p>This releases the time and stops its future reminders. The service request, agreed scope and financial history are kept. A cancellation email will be queued for the customer.</p><label>Reason for the customer<textarea name="reason" required minLength={2} maxLength={1000} placeholder="Briefly explain why this visit is canceled."/></label><div className="actions"><button className="danger-button" disabled={busy}>{busy?'Canceling…':'Confirm appointment cancellation'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>show('overview')}>Keep the appointment</button></div></form>}
      {panel==='schedule'&&proposal&&<button type="button" className="secondary" disabled={locked} onClick={()=>show('reschedule')}>Choose another time</button>}{panel==='schedule'&&<SchedulingReviewPanel key={appointment||request.id} organization={organization} requestId={request.id} appointmentId={appointment===undefined?proposal?.id||null:appointment} initialExpanded initialStart={submission.preferredTime} onBusy={setBusy} completed={changed}/>}
      {(panel==='decline'||panel==='reschedule')&&<form className="decision-form" onSubmit={e=>{e.preventDefault();void decline(e.currentTarget);}}><h4>{panel==='reschedule'?'Choose another appointment time':proposal?'Decline the proposed time':'Decline request'}</h4><p className="tiny">To: {submission.email}</p><fieldset disabled={busy||unknown} className="decline-fields"><DeclineDecisionFields organization={organization} proposal={!!proposal} reschedule={panel==='reschedule'}/></fieldset><p className="tiny">{panel==='reschedule'?'First release this proposed time and send the customer your reason. Then choose a replacement date. The request stays open even if you leave before choosing it.':proposal?'Declining only the time keeps the service request open. Closing the entire request declines the work too. Your saved decision queues the matching customer message.':'This declines the service request and queues the customer message.'}</p><div className="actions"><button className={panel==='reschedule'?'':'danger-button'} disabled={busy}>{busy?'Saving…':panel==='reschedule'?'Send time update & choose replacement':'Approve decline & send message'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>show('overview')}>Back without changes</button></div></form>}
      {request.appointments.filter(a=>!active.includes(a)).length>0&&<details><summary>Previous appointment history</summary>{request.appointments.filter(a=>!active.includes(a)).map(a=><p className="tiny" key={a.id}>{date(a.start_at)} · {visitState(a).replaceAll('_',' ')}</p>)}</details>}
     </section>
     <section className="detail-section request-services"><h3><Icon name="work"/>Services requested</h3><ul className="request-service-chips">{requestTasks(submission).map((s,i)=><li className={'calendar-tone-'+serviceTone([s.service])} key={i}><Icon name={['lawn','garden'].includes(serviceTone([s.service]))?'leaf':'work'}/><strong>{s.task||s.service}</strong></li>)}</ul>{submission.description&&<div className="customer-note"><strong>Customer note</strong><p>{submission.description}</p></div>}{submission.communityRate==='Yes'&&<p className="request-community-flag"><Icon name="users"/>Community Rate requested · review eligibility</p>}</section>
    <div className="detail-contact"><span><Icon name="pin"/>{submissionAddress(submission)}</span><div className="actions"><a className="button secondary" href={'tel:'+submission.phone}><Icon name="phone"/>Call customer</a><a className="button secondary" href={'mailto:'+submission.email}><Icon name="mail"/>Email</a><a className="button secondary" href={navigationUrl(submissionAddress(submission))||undefined} target="_blank" rel="noreferrer"><Icon name="pin"/>Directions</a></div></div>
     <RelationshipNotes organization={organization} type="request" target={request.id} timezone={timezone}/>{canManage&&organization===YNSG_ORGANIZATION&&<RequestReplyDraft key={request.id} name={submission.name} email={submission.email} organization={organization}/>}<details className="request-supporting"><summary>Request details & progress</summary>
    {confirmedHistory&&<div className="workflow-strip" aria-label="Service workflow">{[['Request',true],['Appointment',!!confirmed],['Quote',quotes.some(q=>q.status==='accepted')],['Work',jobs.some(j=>j.status==='completed')],['Invoice',invoices.length>0]].map(([name,done])=><span className={done?'is-done':''} key={String(name)}><i>{done?<Icon name="check"/>:<Icon name="arrow"/>}</i>{String(name)}</span>)}</div>}
<dl className="request-facts"><div><dt>Received</dt><dd>{date(request.created_at)}</dd></div><div><dt>Original timing request</dt><dd>{submission.preferredTime||'No time requested'}</dd></div><div><dt>Community Rate inquiry</dt><dd>{submission.communityRate==='Yes'?'Requested':'Not requested'}</dd></div></dl></details>
     {canManage&&confirmedHistory&&<details><summary>Weekly visits and saved repeat schedules</summary><RecurringVisits key={request.id} organization={organization} requestId={request.id} firstAppointment={confirmed?.job_id?confirmed.id:undefined} onBusy={setBusy} onOpen={id=>{onClose();onWork(id);}} onChanged={()=>{setReload(n=>n+1);onChanged();}}/></details>}
     {confirmedHistory&&!invoices.some(i=>i.job_id===confirmed?.job_id)&&<ScheduledInvoice compact request={request} quotes={quotes} jobs={jobs} timezone={timezone} busy={busy}/>}
     {confirmedHistory&&<section className="detail-section"><details className="request-supporting"><summary>Related records</summary>{quotes.length?<div className="linked-records">{quotes.map(q=><div key={q.id}><Icon name="work"/><span>Quote · {q.status.replaceAll('_',' ')} · Version {q.current_version}</span></div>)}{jobs.map(j=><div key={j.id}><Icon name="check"/><span>Service call · {j.status.replaceAll('_',' ')}</span></div>)}{invoices.map(i=><div key={i.id}><Icon name="money"/><a href={'/invoice?'+new URLSearchParams({organization,invoice:i.id})}>Invoice {invoiceNumber(i.number)} · {(i.total_cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</a></div>)}</div>:<p className="muted">No agreed work recorded yet.</p>}</details></section>}

   </>}
   {error&&!data&&<button className="secondary" onClick={()=>setReload(n=>n+1)}>Try opening again</button>}
  </div>
 </dialog>;
}
