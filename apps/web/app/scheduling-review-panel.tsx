'use client';
import RecurringPreviewPanel from './recurring-preview-panel';
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from 'react';
import { sessionFetch } from '../lib/session-fetch';
import {confirmRequestedAppointment,type ApprovalAttempt} from '../lib/quick-approval';
import { confirmationReview } from '../lib/confirmation-review';
import { localMinute } from '../../../packages/domain/timezone';
import { preferredVisitStart, visitStart, visitTimes, type VisitHours } from '../lib/visit-start';
type Resource={id:string;name:string;kind:string;status:string};
type Context={requestRevision:number;configurationVersion:number;scheduleRevision:number;settings:{timezone:string;scheduling:VisitHours&{bufferMinutes:number|null}};resources:Resource[];confirmedAppointments:{id:string;start:string;end:string}[];appointmentResources?:string[];allowAdditionalResources?:boolean;appointment?:{revision:number;start_at:string;end_at:string;arrival_at:string}};
export default function SchedulingReviewPanel({organization,requestId,appointmentId=null,completed,initialExpanded=false,initialStart,onBusy}:{organization:string;requestId:string;appointmentId?:string|null;completed:(status:string)=>void;initialExpanded?:boolean;initialStart?:string;onBusy?:(busy:boolean)=>void}){
 const [context,setContext]=useState<Context|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 const preference=preferredVisitStart(initialStart);
 const [visitDate,setVisitDate]=useState(preference.date);
 const times=context?visitTimes(visitDate,context.settings.scheduling):[];
 const [expanded,setExpanded]=useState(initialExpanded),[retry,setRetry]=useState(0);
 useEffect(()=>{onBusy?.(pending);},[pending,onBusy]);
 const key=useRef<{fingerprint:string;value:string}|null>(null),sequence=useRef(0),confirmationAttempt=useRef<ApprovalAttempt>(null),savedProposal=useRef<string|null>(null),savedOptions=useRef<{travelBeforeMinutes:number;travelAfterMinutes:number;reviewNote:string}|null>(null);
 useEffect(()=>{const s=++sequence.current;setContext(null);setSelected([]);setError('');setMessage('');setPending(false);key.current=null;confirmationAttempt.current=null;savedProposal.current=null;savedOptions.current=null;if(!expanded)return;
  void sessionFetch('/api/scheduling-review?'+new URLSearchParams({organization,request:requestId,...(appointmentId?{appointment:appointmentId}:{})}),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(s===sequence.current){setContext(d);setSelected(d.appointmentResources||(d.resources.filter((r:Resource)=>r.kind==='operator'&&r.status==='available').length===1?[d.resources.find((r:Resource)=>r.kind==='operator'&&r.status==='available').id]:[]));}}).catch(e=>{if(s===sequence.current)setError(publicError(e));});
  return()=>{sequence.current++;};
 },[organization,requestId,appointmentId,expanded,retry]);
 async function submit(form:HTMLFormElement){
  if(!context||pending)return;const s=sequence.current,fields=new FormData(form),a=context.appointment;
  if(savedProposal.current&&savedOptions.current){
   setPending(true);setError('');
   try{await confirmRequestedAppointment(organization,requestId,savedProposal.current,confirmationAttempt,sessionFetch,savedOptions.current);if(s===sequence.current){setMessage('Appointment confirmed. Calendar and customer email updates are queued.');completed('reserved');}}
   catch(e){if(s===sequence.current)setError('The time is saved but confirmation did not finish. Retry to confirm the same visit. '+publicError(e));}
   finally{if(s===sequence.current)setPending(false);}return;
  }
  let start:string,review:ReturnType<typeof confirmationReview>;
  try{review=confirmationReview(String(fields.get('note')||''));start=a?localMinute(Date.parse(a.start_at),context.settings.timezone):visitStart(fields.get('visitDate'),fields.get('visitTime'),context.settings.scheduling);}
  catch(e){setError(publicError(e));return;}
  const input={organizationId:organization,requestId,requestRevision:context.requestRevision,configurationVersion:context.configurationVersion,scheduleRevision:context.scheduleRevision,appointmentId,appointmentRevision:a?.revision||null,replacesId:fields.get('replacesId')||null,
   localStart:start,durationMinutes:a?(Date.parse(a.end_at)-Date.parse(a.start_at))/60000:Number(fields.get('duration')),
   arrivalOffsetMinutes:a?(Date.parse(a.arrival_at)-Date.parse(a.start_at))/60000:Number(fields.get('arrivalOffset')),
   resources:selected,travelBeforeMinutes:Number(fields.get('travelBefore')),travelAfterMinutes:Number(fields.get('travelAfter')),...review};
  const fingerprint=JSON.stringify(input);if(key.current?.fingerprint!==fingerprint)key.current={fingerprint,value:crypto.randomUUID()};
  setPending(true);setError('');setMessage('');
  try{const r=await sessionFetch('/api/scheduling-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,key:key.current.value})});const d=await r.json();if(!r.ok)throw Error(d.error);
   if(d.result.status!=='reserved'){
    savedProposal.current=d.result.id;
    savedOptions.current={travelBeforeMinutes:input.travelBeforeMinutes,travelAfterMinutes:input.travelAfterMinutes,reviewNote:input.reviewNote};
    await confirmRequestedAppointment(organization,requestId,d.result.id,confirmationAttempt,sessionFetch,{travelBeforeMinutes:input.travelBeforeMinutes,travelAfterMinutes:input.travelAfterMinutes,reviewNote:input.reviewNote});
   }
   if(s===sequence.current){setMessage('Appointment confirmed. Calendar and customer email updates are queued.');completed('reserved');}}
  catch(e){if(s===sequence.current)setError((savedProposal.current?'The time is saved but confirmation did not finish. Retry to confirm the same visit. ':'')+publicError(e));}
  finally{if(s===sequence.current)setPending(false);}
 }
 return <div className="schedule-review">{!initialExpanded&&<button type="button" className="secondary" aria-expanded={expanded} disabled={pending} onClick={()=>setExpanded(v=>!v)}>{appointmentId?'Confirm requested time':'Choose a time'}</button>}
  {expanded&&<div className="card"><h3>{appointmentId?'Confirm this appointment':'Choose the appointment time'}</h3><p>Check the time, visit length and travel. We check calendar conflicts automatically when you save.</p>
   {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
   {savedProposal.current&&<p className="note">Your chosen time is saved. Retry finishes confirmation of that visit.</p>}
   {!context?(error?<button type="button" onClick={()=>setRetry(v=>v+1)}>Try again</button>:<p role="status">Loading appointment details…</p>):<form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}}>
    {context.appointment&&<p className="note"><strong>Customer arrival: {new Intl.DateTimeFormat('en-US',{timeZone:context.settings.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(context.appointment.arrival_at))}</strong><br/>Reserved work: {new Intl.DateTimeFormat('en-US',{timeZone:context.settings.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(context.appointment.start_at))} – {new Intl.DateTimeFormat('en-US',{timeZone:context.settings.timezone,timeStyle:'short'}).format(new Date(context.appointment.end_at))}</p>}<p className="tiny">Times use {context.settings.timezone}.</p>
    <fieldset disabled={pending||Boolean(savedProposal.current)} style={{border:0,padding:0,margin:0}}>
    {!appointmentId&&<><label>Visit date<input name="visitDate" type="date" required value={visitDate} onChange={e=>setVisitDate(e.target.value)}/></label><label>Visit start time<select name="visitTime" key={visitDate} required disabled={!times.length} defaultValue={times.includes(preference.time)?preference.time:""}><option value="">Choose a start time</option>{times.map(time=>{const [hour,minute]=time.split(":");const h=Number(hour);return <option key={time} value={time}>{h%12||12}:{minute} {h>=12?"PM":"AM"}</option>;})}</select></label><p className="tiny">{!visitDate?"Choose the visit date to see working-hour start times.":!times.length?"No appointment starts on this date. Choose a configured working day.":"These are working-hour start times. Availability is checked against your Google calendar when you save."}</p><label>Visit length (minutes)<input name="duration" type="number" required min="120" max="1440" step="30" defaultValue="120"/></label><details open={context.confirmedAppointments.length>0}><summary>Supplier pickup & replacement visit</summary><label>Supplier pickup time before customer arrival (minutes)<input name="arrivalOffset" type="number" required min="0" max="1439" defaultValue="0"/></label><p className="note">For a pickup visit, reserved work starts at the supplier. Customer-paid mulch or larger items must be ready and paid directly to the supplier. Include pickup, delivery and application in the same visit.</p><label>Appointment type<select name="replacesId" defaultValue={context.confirmedAppointments.length===1?context.confirmedAppointments[0]!.id:""}><option value="">New appointment</option>{context.confirmedAppointments.map(a=><option value={a.id} key={a.id}>Replace {new Intl.DateTimeFormat(undefined,{timeZone:context.settings.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(a.start))}</option>)}</select><span className="tiny">A replaced appointment stays booked until its replacement is approved.</span></label></details></>}
    <p className="note">Assigned: {selected.length?context.resources.filter(r=>selected.includes(r.id)).map(r=>r.name).join(", "):"Choose an operator below"}</p><details open={!selected.length}><summary>Change people & equipment</summary><fieldset><legend>People & equipment for this visit</legend>{context.resources.map(r=><label key={r.id}><input type="checkbox" disabled={(Boolean(appointmentId)&&(!context.allowAdditionalResources||Boolean(context.appointmentResources?.includes(r.id))))||r.status!=='available'} checked={selected.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id))}/>{r.name} · {r.kind} · {r.status.replaceAll('_',' ')}</label>)}</fieldset></details>
    <details><summary>Extra travel time (optional)</summary><p className="tiny">Your standard {context.settings.scheduling.bufferMinutes}-minute buffer covers travel and setup. Add extra time only if this visit needs more.</p><label>Extra travel before this visit (minutes)<input name="travelBefore" defaultValue="0" type="number" min="0" max="360" required/></label><label>Extra travel after this visit (minutes)<input name="travelAfter" defaultValue="0" type="number" min="0" max="360" required/></label></details>
    <details><summary>Add a private scheduling note (optional)</summary><label>Scheduling note<textarea name="note" maxLength={2800} placeholder="Anything useful for this visit."/></label></details>
    <p className="note">By confirming, I have checked the requested work, visit length, assigned people and equipment, and any supplier pickup.</p>
    </fieldset>
    <button disabled={pending||!selected.length||(!appointmentId&&!times.length)}>{pending?'Checking and saving…':appointmentId?'Confirm appointment':savedProposal.current?'Retry confirmation':'Schedule appointment'}</button>
   </form>}
   {context&&!appointmentId&&<details><summary>Repeat visits (optional)</summary><RecurringPreviewPanel key={selected.join(",")} organization={organization} requestId={requestId} resources={selected}/></details> }
  </div>}
 </div>;
}
