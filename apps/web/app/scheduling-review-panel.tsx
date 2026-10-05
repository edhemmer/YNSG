'use client';
import RecurringPreviewPanel from './recurring-preview-panel';
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from 'react';
import { sessionFetch } from '../lib/session-fetch';
import { localMinute } from '../../../packages/domain/timezone';
type Resource={id:string;name:string;kind:string;status:string};
type Context={requestRevision:number;configurationVersion:number;scheduleRevision:number;settings:{timezone:string};resources:Resource[];confirmedAppointments:{id:string;start:string;end:string}[];appointmentResources?:string[];allowAdditionalResources?:boolean;appointment?:{revision:number;start_at:string;end_at:string;arrival_at:string}};
export default function SchedulingReviewPanel({organization,requestId,appointmentId=null,completed}:{organization:string;requestId:string;appointmentId?:string|null;completed:()=>void}){
 const [context,setContext]=useState<Context|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 const [expanded,setExpanded]=useState(false),[retry,setRetry]=useState(0);
 const key=useRef<{fingerprint:string;value:string}|null>(null),sequence=useRef(0);
 useEffect(()=>{const s=++sequence.current;setContext(null);setSelected([]);setError('');setMessage('');setPending(false);key.current=null;if(!expanded)return;
  void sessionFetch('/api/scheduling-review?'+new URLSearchParams({organization,request:requestId,...(appointmentId?{appointment:appointmentId}:{})}),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(s===sequence.current){setContext(d);setSelected(d.appointmentResources||[]);}}).catch(e=>{if(s===sequence.current)setError(publicError(e));});
  return()=>{sequence.current++;};
 },[organization,requestId,appointmentId,expanded,retry]);
 async function submit(form:HTMLFormElement){
  if(!context)return;const s=sequence.current,fields=new FormData(form),a=context.appointment;
  const input={organizationId:organization,requestId,requestRevision:context.requestRevision,configurationVersion:context.configurationVersion,scheduleRevision:context.scheduleRevision,appointmentId,appointmentRevision:a?.revision||null,replacesId:fields.get('replacesId')||null,
   localStart:a?localMinute(Date.parse(a.start_at),context.settings.timezone):fields.get('localStart'),durationMinutes:a?(Date.parse(a.end_at)-Date.parse(a.start_at))/60000:Number(fields.get('duration')),
   arrivalOffsetMinutes:a?(Date.parse(a.arrival_at)-Date.parse(a.start_at))/60000:Number(fields.get('arrivalOffset')),
   resources:selected,travelBeforeMinutes:Number(fields.get('travelBefore')),travelAfterMinutes:Number(fields.get('travelAfter')),scopeReviewed:fields.get('scopeReviewed')==='on',equipmentReviewed:fields.get('equipmentReviewed')==='on',pickupReviewed:fields.get('pickupReviewed')==='on',reviewNote:fields.get('note')};
  const fingerprint=JSON.stringify(input);if(key.current?.fingerprint!==fingerprint)key.current={fingerprint,value:crypto.randomUUID()};
  setPending(true);setError('');setMessage('');
  try{const r=await sessionFetch('/api/scheduling-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,key:key.current.value})});const d=await r.json();if(!r.ok)throw Error(d.error);if(s===sequence.current){setMessage(d.result.status==='reserved'?'Appointment confirmed. Calendar and customer email status are tracked separately.':'Proposed time saved. It remains tentative until approved.');completed();}}
  catch(e){if(s===sequence.current)setError(publicError(e));}
  finally{if(s===sequence.current)setPending(false);}
 }
 return <div className="schedule-review"><button type="button" className="secondary" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{appointmentId?'Review and approve this time':'Schedule this request'}</button>
  {expanded&&<div className="card"><h3>{appointmentId?'Appointment approval review':'Propose an appointment'}</h3><p>Review the actual work, both travel legs, required equipment and any supplier pickup. Google is checked again when you save. This does not approve the price or extra work.</p>
   {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
   {!context?<button type="button" onClick={()=>setRetry(v=>v+1)}>Reload review</button>:<form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}}>
    <p>Times use {context.settings.timezone}.</p>
    {!appointmentId&&<><label>Reserved start<input name="localStart" type="datetime-local" required step="1800"/></label><label>Reserved work minutes<input name="duration" type="number" required min="120" max="1440" step="30" defaultValue="120"/></label><label>Minutes from reserved start until arrival at the customer<input name="arrivalOffset" type="number" required min="0" max="1439" defaultValue="0"/></label><p className="note">For a pickup visit, reserved work starts at the supplier. Customer-paid mulch or larger items must be ready and paid directly to the supplier. Include pickup, delivery and application in the same visit.</p><label>Appointment type<select name="replacesId" defaultValue=""><option value="">New appointment</option>{context.confirmedAppointments.map(a=><option value={a.id} key={a.id}>Replace {new Intl.DateTimeFormat(undefined,{timeZone:context.settings.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(a.start))}</option>)}</select><span className="tiny">A replaced appointment stays booked until its replacement is approved.</span></label></>}
    <fieldset><legend>Operator and every required resource</legend>{context.resources.map(r=><label key={r.id}><input type="checkbox" disabled={(Boolean(appointmentId)&&(!context.allowAdditionalResources||Boolean(context.appointmentResources?.includes(r.id))))||r.status!=='available'} checked={selected.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id))}/>{r.name} · {r.kind} · {r.status.replaceAll('_',' ')}</label>)}</fieldset>
    <label>Verified travel minutes before this visit<input name="travelBefore" type="number" min="0" max="360" required/></label><label>Verified travel minutes after this visit<input name="travelAfter" type="number" min="0" max="360" required/></label><p>Enter zero only after checking that no travel leg is required. The configured setup buffer is added separately.</p>
    <label><input name="scopeReviewed" type="checkbox" required/>I reviewed every requested service and the reserved duration.</label>
    <label><input name="equipmentReviewed" type="checkbox" required/>I selected and verified all required people, equipment and trailer capacity.</label>
    <label><input name="pickupReviewed" type="checkbox" required/>I checked pickup location, supplier hours, payment/readiness and customer arrival, or confirmed that no pickup is needed.</label>
    <label>Review evidence<textarea name="note" minLength={10} maxLength={3000} required placeholder="Record how you verified the route, scope, resources and any pickup."/></label>
    <button disabled={pending||!selected.length}>{pending?'Checking and saving…':appointmentId?'Approve reviewed appointment':'Save proposed time'}</button>
   </form>}
   {context&&!appointmentId&&<RecurringPreviewPanel key={selected.join(",")} organization={organization} requestId={requestId} resources={selected}/> }
  </div>}
 </div>;
}
