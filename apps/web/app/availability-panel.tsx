'use client';
import { publicError } from "../lib/public-errors";
import { useEffect, useRef, useState } from 'react';
import { sessionFetch } from '../lib/session-fetch';
type Resource = { id: string; name: string; kind: string; status: string };
type Result = { times: { start: string; end: string }[]; checkedAt: string; validUntil: string; timezone: string; windowEnd: string };
export default function AvailabilityPanel({ organization }: { organization: string }) {
 const [resources,setResources]=useState<Resource[]>([]), [selected,setSelected]=useState<string[]>([]);
 const [duration,setDuration]=useState('120'),[result,setResult]=useState<Result|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const [stale,setStale]=useState(false);
 const sequence=useRef(0);
 useEffect(()=>{ sequence.current++;setResources([]);setSelected([]);setLoaded(false);setResult(null);setError('');setPending(false); },[organization]);
 useEffect(()=>{
  if(!result)return;
  setStale(Date.parse(result.validUntil)<=Date.now());
  const timer=setTimeout(()=>setStale(true),Math.max(0,Date.parse(result.validUntil)-Date.now()));
  return ()=>clearTimeout(timer);
 },[result]);
 async function check(loadOnly=false){
  const seq=++sequence.current;setPending(true);setError('');setResult(null);
  try{
   const query=new URLSearchParams({organization});
   if(!loadOnly){query.set('resources',selected.join(','));query.set('durationMinutes',duration);}
   const response=await sessionFetch('/api/availability?'+query,{cache:'no-store'});
   const value=await response.json();
   if(!response.ok)throw new Error(value.error||'Times could not be checked.');
   if(seq!==sequence.current)return;
   if(loadOnly){setResources(value.resources);setLoaded(true);}else setResult(value);
  }catch(e){if(seq===sequence.current)setError(publicError(e));}
  finally{if(seq===sequence.current)setPending(false);}
 }
 function invalidate(){sequence.current++;setResult(null);setPending(false);}
 const format=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:result!.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 return <section className="card" aria-labelledby="availability-heading">
  <h2 id="availability-heading">Check open times</h2>
  <p>Check your calendar before reviewing a new appointment. These times still need scope, travel, equipment and pickup review.</p>
  {!loaded?<button disabled={pending} onClick={()=>void check(true)}>{pending?'Loading…':'Choose resources'}</button>:<form onSubmit={e=>{e.preventDefault();void check();}}>
   <fieldset><legend>Who and what does this visit need?</legend>
    {resources.map(r=><label key={r.id}><input type="checkbox" disabled={r.status!=='available'} checked={selected.includes(r.id)} onChange={e=>{invalidate();setSelected(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id));}}/>{r.name} · {r.kind.replaceAll('_',' ')}{r.status!=='available'?' · unavailable':''}</label>)}
    {!resources.length&&<p>Add an operator and required equipment before checking times.</p>}
   </fieldset>
   <label>Reserved work time<select value={duration} onChange={e=>{invalidate();setDuration(e.target.value);}}>{[120,150,180,210,240,300,360,420,480].map(minutes=><option key={minutes} value={minutes}>{minutes/60} hours</option>)}</select></label>
   <button disabled={pending||!selected.some(id=>resources.some(r=>r.id===id&&r.kind==='operator'&&r.status==='available'))}>{pending?'Checking calendar…':'Check times'}</button>
  </form>}
  {error&&<p role="alert">{error}</p>}
  {result&&<div aria-live="polite">
   <p className="note"><strong>{stale?'This check has expired. Check times again.':'Calendar checked. No time is reserved.'}</strong><br/>Travel and supplier readiness still require review. A final reservation must recheck these times.</p>
   <p>Starts checked through {format(result.windowEnd)} · {result.timezone}</p>
   {!result.times.length?<p>No open times in this booking window. The system has kept your configured hours and advance-notice rules.</p>:<ul>{result.times.map(t=><li key={t.start}>{format(t.start)} — {new Intl.DateTimeFormat('en-US',{timeZone:result.timezone,timeStyle:'short'}).format(new Date(t.end))}</li>)}</ul>}
  </div>}
 </section>;
}
