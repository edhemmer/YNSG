'use client';
import {useRef,useState,useEffect} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
type Preview={occurrences:{date:string;start:string;end:string;available:boolean}[];endExclusive:string;timezone:string;conflicts:number;reserved:false;validUntil:string};
export default function RecurringPreviewPanel({organization,requestId,resources}:{organization:string;requestId:string;resources:string[]}){
 const [result,setResult]=useState<Preview|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;},[]);
 async function preview(form:HTMLFormElement){
  const ticket=++sequence.current,fields=new FormData(form);setPending(true);setResult(null);setError('');
  try{
   const response=await sessionFetch('/api/recurring-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,request:requestId,resources,localStart:fields.get('first'),durationMinutes:Number(fields.get('duration')),travelBeforeMinutes:Number(fields.get('before')),travelAfterMinutes:Number(fields.get('after'))})});
   const data=await response.json();if(!response.ok)throw Error(data.error);if(ticket===sequence.current)setResult(data);
  }catch(e){if(ticket===sequence.current)setError(publicError(e));}
  finally{if(ticket===sequence.current)setPending(false);}
 }
 function clear(){sequence.current++;setResult(null);setError('');setPending(false);}
 return <details className="card"><summary>Check a weekly schedule for 12 months</summary>
  <p>This checks the same local weekday and time for the full year against your calendar, blocked time and selected resources. This preview does not book appointments. Travel times need your review.</p>
  <form onChange={clear} onSubmit={e=>{e.preventDefault();void preview(e.currentTarget);}}>
   <label>First visit<input name="first" type="datetime-local" step="1800" required/></label>
   <label>Visit duration in minutes<input name="duration" type="number" min="120" max="1440" step="30" defaultValue="120" required/></label>
   <label>Travel minutes before each visit<input name="before" type="number" min="0" max="360" required/></label>
   <label>Travel minutes after each visit<input name="after" type="number" min="0" max="360" required/></label>
   <button disabled={pending||!resources.length}>{pending?'Checking the year…':'Check weekly dates'}</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {result&&<div role="status"><p>{result.occurrences.length} dates checked in {result.timezone}. {result.conflicts} dates need a different time. No appointments booked.</p><p>Checked through the day before {result.endExclusive}. Refresh this preview before making any scheduling decision.</p><ul>{result.occurrences.map(v=><li key={v.date}>{v.date} — {v.available?'No conflict found at this check':'Time needs review'}</li>)}</ul></div>}
 </details>;
}
