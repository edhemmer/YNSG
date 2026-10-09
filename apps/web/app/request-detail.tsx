'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {requestStage,requestTasks,visitState,type InboxData,type Visit} from '../lib/request-inbox';
import {navigationUrl} from '../lib/day-plan';
import Icon from './crm-icons';
import SchedulingReviewPanel from './scheduling-review-panel';
import RelationshipNotes from './relationship-notes';
type Props={organization:string;requestId:string;timezone:string;canManage:boolean;onClose:()=>void;onChanged:()=>void;onWork:(requestId:string)=>void};
export default function RequestDetail({organization,requestId,timezone,canManage,onClose,onChanged,onWork}:Props){
 const dialog=useRef<HTMLDialogElement>(null),keys=useRef(new Map<string,string>());
 const [data,setData]=useState<InboxData|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [panel,setPanel]=useState<'overview'|'schedule'|'decline'|'reschedule'|'notes'>('overview'),[appointment,setAppointment]=useState<string|null>(null);
 useEffect(()=>{const el=dialog.current,returnFocus=document.activeElement;el?.showModal();return()=>{el?.close();if(returnFocus instanceof HTMLElement&&returnFocus.isConnected)returnFocus.focus();};},[]);
 useEffect(()=>{const controller=new AbortController();let live=true;setError('');
  void sessionFetch('/api/request-inbox?'+new URLSearchParams({organization,request:requestId,filter:'all'}),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live)setData(d);}).catch(e=>{if(live&&!controller.signal.aborted)setError(publicError(e));});
  return()=>{live=false;controller.abort();};
 },[organization,requestId,reload]);
 const request=data?.requests[0],submission=request?.original_submission;
 const active=request?.appointments.filter(a=>['proposal','reserved','needs_review'].includes(visitState(a)))||[];
 const proposal=active.find(a=>visitState(a)==='proposal'),confirmed=active.find(a=>a.status==='reserved');
 const stage=request?requestStage(request):null;
 const date=(v:string)=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
 async function command(path:string,input:Record<string,unknown>){
  if(busy)return false;setBusy(true);setError('');setMessage('');const fingerprint=JSON.stringify([organization,path,input]);
  if(!keys.current.has(fingerprint))keys.current.set(fingerprint,crypto.randomUUID());
  try{const r=await sessionFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:organization,key:keys.current.get(fingerprint),...input})});const value=await r.json();if(!r.ok)throw Error(value.error);setMessage('Saved. Calendar updates and customer messages will be handled by your connected automation.');setReload(n=>n+1);onChanged();return true;}
  catch(e){setError(publicError(e));return false;}finally{setBusy(false);}
 }
 async function review(target:string|null){
  if(!request)return;
  if(request.status==='submitted'&&!await command('/api/commands',{command:'ReviewRequest',id:request.id,revision:request.revision,status:'reviewing'}))return;
  setAppointment(target);setPanel('schedule');
 }
 function changed(status:string){setBusy(false);setPanel('overview');setMessage(status==='reserved'?'Appointment confirmed. Calendar updates and the customer confirmation are queued.':'Proposed time saved. Select Accept proposed time to confirm it.');setReload(n=>n+1);onChanged();}
 async function decline(form:HTMLFormElement){
  if(!request)return;const f=new FormData(form),choice=String(f.get('choice'));
  if(proposal){if(await command('/api/scheduling',{schemaVersion:1,input:{action:choice,id:proposal.id,revision:proposal.revision,reason:f.get('reason')}})){if(choice==='decline_time'&&panel==='reschedule'){setAppointment(null);setPanel('schedule');}else setPanel('overview');}}
  else if(await command('/api/commands',{command:'ReviewRequest',id:request.id,revision:request.revision,status:'declined'}))setPanel('overview');
 }
 const quotes=data?.quotes.filter(q=>q.request_id===requestId)||[];
 const quoteIds=new Set(quotes.map(q=>q.id)),jobs=data?.jobs.filter(j=>quoteIds.has(j.quote_id))||[],jobIds=new Set(jobs.map(j=>j.id)),invoices=data?.invoices.filter(i=>jobIds.has(i.job_id))||[];
 return <dialog className="request-dialog" ref={dialog} aria-labelledby="request-detail-title" onCancel={e=>{e.preventDefault();if(busy)return;onClose();}}>
  <header className="detail-top"><div><p className="eyebrow">Service request</p><h2 id="request-detail-title">{submission?.name||'Loading request…'}</h2>{stage&&<span className={'status-pill tone-'+stage.tone}>{stage.label}</span>}</div><button className="icon-button secondary" type="button" aria-label="Close request" disabled={busy} onClick={onClose}><Icon name="close"/></button></header>
  <div className="detail-body">
   {error&&<p className="error note" role="alert">{error}</p>}{message&&<p className="note" role="status">{message}</p>}
   {!data&&!error&&<div className="loading" role="status">Opening the complete request…</div>}
   {data&&!request&&<div className="empty-state"><h3>Request unavailable</h3><p>This request may belong to another business or no longer be available to your account.</p></div>}
   {request&&submission&&<>
    <div className="workflow-strip" aria-label="Service workflow">{[['Request',true],['Appointment',!!confirmed],['Quote',quotes.some(q=>q.status==='accepted')],['Work',jobs.some(j=>j.status==='completed')],['Invoice',invoices.length>0]].map(([name,done])=><span className={done?'is-done':''} key={String(name)}><i>{done?<Icon name="check"/>:<Icon name="arrow"/>}</i>{String(name)}</span>)}</div>
    <div className="detail-contact"><span><Icon name="pin"/>{submission.street}, {submission.city}</span><div className="actions"><a className="button secondary" href={'tel:'+submission.phone}><Icon name="phone"/>Call customer</a><a className="button secondary" href={'mailto:'+submission.email}><Icon name="mail"/>Email</a><a className="button secondary" href={navigationUrl([submission.street,submission.city].filter(Boolean).join(', '))||undefined} target="_blank" rel="noreferrer"><Icon name="pin"/>Directions</a></div></div>
    <div className="detail-tabs" role="group" aria-label="Request details"><button type="button" aria-pressed={panel!=='notes'} onClick={()=>setPanel('overview')} disabled={busy}>Work & appointment</button><button type="button" aria-pressed={panel==='notes'} onClick={()=>setPanel('notes')} disabled={busy}>Private notes</button></div>
    {panel==='notes'?<RelationshipNotes organization={organization} type="request" target={request.id} timezone={timezone}/>:<>
     <section className="detail-section"><h3>What needs doing</h3><ul className="service-checklist">{requestTasks(submission).map((s,i)=><li key={i}><Icon name="check"/><div><strong>{s.task||s.service}</strong><span>{s.service}</span></div></li>)}</ul>{submission.description&&<p className="customer-note">{submission.description}</p>}<dl className="request-facts"><div><dt>Received</dt><dd>{date(request.created_at)}</dd></div><div><dt>Requested timing</dt><dd>{submission.preferredTime||'Arrange a time with the customer'}</dd></div><div><dt>Community Rate inquiry</dt><dd>{submission.communityRate==='Yes'?'Requested — review eligibility':'Not requested'}</dd></div></dl></section>
     {data.preferences.filter(p=>p.request_id===requestId).map(p=><div className="note" key={p.id}><strong>Customer requested another time</strong><p>{p.preferred_local_start?.replace('T',' at ')} {p.preferred_local_start&&`(${p.timezone})`}</p><p>{p.note}</p><small>The original appointment stays booked until its replacement is approved.</small></div>)}
     <section className="detail-section"><div className="section-heading"><h3>Appointment</h3><span className="tiny">{timezone.replaceAll('_',' ')}</span></div>
      {active.length?active.map(a=><div className={'appointment-focus '+(a.status==='proposal'?'awaiting-approval':'')} key={a.id}><div className="appointment-date-icon"><Icon name="calendar"/></div><div><strong>{date(a.arrival_at||a.start_at)}</strong><p>{a.status==='proposal'?'Proposed time — your decision is needed':a.status==='reserved'?'Confirmed appointment':'Schedule needs review'}</p><small>Work window: {date(a.start_at)} – {new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeStyle:'short'}).format(new Date(a.end_at))}</small>{a.replaces_id&&<p>Replacement proposed; original stays booked until approval.</p>}</div></div>):<div className="empty-inline"><Icon name="calendar"/><p>No confirmed appointment. Choose a time after reviewing the work.</p></div>}
      {canManage&&['submitted','reviewing','quoted'].includes(request.status)&&panel==='overview'&&<div className="decision-actions"><button type="button" disabled={busy} onClick={()=>void review(proposal?.id||null)}><Icon name={proposal?'check':'calendar'}/>{busy?'Opening review…':proposal?'Accept proposed time':confirmed?'Reschedule appointment':'Schedule appointment'}</button>{proposal&&<button type="button" className="secondary" disabled={busy} onClick={()=>setPanel('reschedule')}>Choose another time</button>}{!confirmed&&(!!proposal||request.status!=='quoted')&&<button type="button" className="danger-ghost" disabled={busy} onClick={()=>setPanel('decline')}>{proposal?'Decline proposed time':'Decline request'}</button>}</div>}
      {panel==='schedule'&&<SchedulingReviewPanel key={appointment||request.id} organization={organization} requestId={request.id} appointmentId={appointment} initialExpanded initialStart={submission.preferredTime} onBusy={setBusy} completed={changed}/>}
      {(panel==='decline'||panel==='reschedule')&&<form className="decision-form" onSubmit={e=>{e.preventDefault();void decline(e.currentTarget);}}><h4>{panel==='reschedule'?'Choose another appointment time':proposal?'Decline the proposed time':'Decline request'}</h4>{proposal&&(panel==='reschedule'?<input type="hidden" name="choice" value="decline_time"/>:<label>What are you declining?<select name="choice" defaultValue="decline_time"><option value="decline_time">Only this time — keep the request open</option><option value="decline_service">The entire service request — close it</option></select></label>)}{proposal&&<label>Reason for the customer<textarea name="reason" minLength={2} maxLength={1000} required placeholder="A clear, neighborly explanation."/></label>}<p className="tiny">{panel==='reschedule'?'First release this proposed time and send the customer your reason. Then choose a replacement date. The request stays open even if you leave before choosing it.':proposal?'Declining only the time keeps the service request open. Closing the entire request declines the work too. Your saved decision queues the matching customer message.':'This declines the service request and queues the customer message.'}</p><div className="actions"><button className={panel==='reschedule'?'':'danger-button'} disabled={busy}>{busy?'Saving…':panel==='reschedule'?'Release time & choose replacement':'Save decline decision'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>setPanel('overview')}>Back without changes</button></div></form>}
      {request.appointments.filter(a=>!active.includes(a)).length>0&&<details><summary>Previous appointment history</summary>{request.appointments.filter(a=>!active.includes(a)).map(a=><p className="tiny" key={a.id}>{date(a.start_at)} · {visitState(a).replaceAll('_',' ')}</p>)}</details>}
     </section>
     <section className="detail-section"><h3>Quote, work & invoice</h3>{quotes.length?<div className="linked-records">{quotes.map(q=><div key={q.id}><Icon name="work"/><span>Quote · {q.status.replaceAll('_',' ')} · Version {q.current_version}</span></div>)}{jobs.map(j=><div key={j.id}><Icon name="check"/><span>Service call · {j.status.replaceAll('_',' ')}</span></div>)}{invoices.map(i=><div key={i.id}><Icon name="money"/><a href={'/invoice?'+new URLSearchParams({organization,invoice:i.id})}>Invoice {i.number} · {(i.total_cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</a></div>)}</div>:<p className="muted">Prepare a quote when the scope and price are ready. Scheduling does not approve extra work or charges.</p>}<button className="secondary" onClick={()=>onWork(request.id)} disabled={busy}><Icon name="work"/>Open quote & job workspace</button></section>
    </>}
   </>}
   {error&&!data&&<button className="secondary" onClick={()=>setReload(n=>n+1)}>Try opening again</button>}
  </div>
 </dialog>;
}
