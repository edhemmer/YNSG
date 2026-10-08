'use client';
import RecurringPreviewPanel from './recurring-preview-panel';
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from 'react';
import { sessionFetch } from '../lib/session-fetch';
import { localMinute } from '../../../packages/domain/timezone';
type Resource={id:string;name:string;kind:string;status:string};
type Context={requestRevision:number;configurationVersion:number;scheduleRevision:number;settings:{timezone:string};resources:Resource[];confirmedAppointments:{id:string;start:string;end:string}[];appointmentResources?:string[];allowAdditionalResources?:boolean;appointment?:{revision:number;start_at:string;end_at:string;arrival_at:string}};
export default function SchedulingReviewPanel({organization,requestId,appointmentId=null,completed,initialExpanded=false,initialStart,onBusy}:{organization:string;requestId:string;appointmentId?:string|null;completed:()=>void;initialExpanded?:boolean;initialStart?:string;onBusy?:(busy:boolean)=>void}){
 const [context,setContext]=useState<Context|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 const [expanded,setExpanded]=useState(initialExpanded),[retry,setRetry]=useState(0);
 useEffect(()=>{onBusy?.(pending);},[pending,onBusy]);
 const key=useRef<{fingerprint:string;value:string}|null>(null),sequence=useRef(0);
 useEffect(()=>{const s=++sequence.current;setContext(null);setSelected([]);setError('');setMessage('');setPending(false);key.current=null;if(!expanded)return;
  void sessionFetch('/api/scheduling-review?'+new URLSearchParams({organization,request:requestId,...(appointmentId?{appointment:appointmentId}:{})}),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(s===sequence.current){setContext(d);setSelected(d.appointmentResources||(d.resources.filter((r:Resource)=>r.kind==='operator'&&r.status==='available').length===1?[d.resources.find((r:Resource)=>r.kind==='operator'&&r.status==='available').id]:[]));}}).catch(e=>{if(s===sequence.current)setError(publicError(e));});
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
 return <div className="schedule-review"><button type="button" className="secondary" aria-expanded={expanded} disabled={pending} onClick={()=>setExpanded(v=>!v)}>{appointmentId?'Appointment confirmation checks':'Choose and review a time'}</button>
  {expanded&&<div className="card"><h3>{appointmentId?'Confirm this appointment':'Schedule the visit'}</h3><p>Check the visit details below. Your connected Google calendar is checked automatically when you save; the customer notice and calendar update follow your saved decision.</p>
   {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
   {!context?<button type="button" onClick={()=>setRetry(v=>v+1)}>Reload review</button>:<form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}}>
    <p>Times use {context.settings.timezone}. The work and price approvals remain separate.</p>
    {!appointmentId&&<><label>Visit start<input name="localStart" type="datetime-local" required step="1800" defaultValue={initialStart?.match(/(\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})/)?.slice(1).join("T")||""}/></label><label>Visit length (minutes)<input name="duration" type="number" required min="120" max="1440" step="30" defaultValue="120"/></label><label>Supplier pickup time before customer arrival (minutes)<input name="arrivalOffset" type="number" required min="0" max="1439" defaultValue="0"/></label><p className="note">For a pickup visit, reserved work starts at the supplier. Customer-paid mulch or larger items must be ready and paid directly to the supplier. Include pickup, delivery and application in the same visit.</p><label>Appointment type<select name="replacesId" defaultValue={context.confirmedAppointments.length===1?context.confirmedAppointments[0]!.id:""}><option value="">New appointment</option>{context.confirmedAppointments.map(a=><option value={a.id} key={a.id}>Replace {new Intl.DateTimeFormat(undefined,{timeZone:context.settings.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(a.start))}</option>)}</select><span className="tiny">A replaced appointment stays booked until its replacement is approved.</span></label></>}
    <fieldset><legend>People & equipment for this visit</legend>{context.resources.map(r=><label key={r.id}><input type="checkbox" disabled={(Boolean(appointmentId)&&(!context.allowAdditionalResources||Boolean(context.appointmentResources?.includes(r.id))))||r.status!=='available'} checked={selected.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id))}/>{r.name} · {r.kind} · {r.status.replaceAll('_',' ')}</label>)}</fieldset>
    <label>Travel to this visit (minutes)<input name="travelBefore" type="number" min="0" max="360" required/></label><label>Travel after this visit (minutes)<input name="travelAfter" type="number" min="0" max="360" required/></label><p>Enter zero only after checking that no travel leg is required. The configured setup buffer is added separately.</p>
    <label><input name="scopeReviewed" type="checkbox" required/>I reviewed every requested service and the reserved duration.</label>
    <label><input name="equipmentReviewed" type="checkbox" required/>I selected and verified all required people, equipment and trailer capacity.</label>
    <label><input name="pickupReviewed" type="checkbox" required/>I checked pickup location, supplier hours, payment/readiness and customer arrival, or confirmed that no pickup is needed.</label>
    <label>Visit review notes<textarea name="note" minLength={10} maxLength={3000} required placeholder="Note the work, travel and equipment checks, plus any pickup arrangements."/></label>
    <button disabled={pending||!selected.length}>{pending?'Checking and saving…':appointmentId?'Confirm appointment & queue customer notice':'Save proposed appointment'}</button>
   </form>}
   {context&&!appointmentId&&<RecurringPreviewPanel key={selected.join(",")} organization={organization} requestId={requestId} resources={selected}/> }
  </div>}
 </div>;
}
