"use client";
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {localInstant,localMinute} from '../../../packages/domain/timezone';
import {calendarBlockCommand,calendarBlockList,calendarBlockRejection,validateCalendarBlockReceipt,type CalendarBlock,type CalendarBlockCommand} from '../lib/calendar-block-contract';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
type Props={organization:string;timezone:string;revision?:number;onChanged?:()=>void|Promise<void>};
type Selection={kind:'edit'|'remove';block:CalendarBlock};
export default function CalendarBlocks(props:Props){return <BlockEditor key={props.organization+':'+props.timezone} {...props}/>;}
function BlockEditor({organization,timezone,revision=0,onChanged}:Props){
 const [blocks,setBlocks]=useState<CalendarBlock[]|null>(null),[start,setStart]=useState(''),[end,setEnd]=useState(''),[selection,setSelection]=useState<Selection|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[unknown,setUnknown]=useState(false),[syncNeeded,setSyncNeeded]=useState(false),[loading,setLoading]=useState(false),[stale,setStale]=useState(true),[denied,setDenied]=useState(false),[accessNeeded,setAccessNeeded]=useState(false),[page,setPage]=useState(0);
 const mounted=useRef(true),generation=useRef(0),sending=useRef(false),acknowledged=useRef(''),attempt=useRef<{body:string;command:CalendarBlockCommand}|null>(null),startInput=useRef<HTMLInputElement>(null),removeButton=useRef<HTMLButtonElement>(null);
 const busy=pending||unknown||syncNeeded,dirty=Boolean(start||end||selection),locked=busy||loading||stale;
 const latest=selection?blocks?.find(b=>b.id===selection.block.id):null,selectionChanged=Boolean(selection&&blocks&&(!latest||latest.revision!==selection.block.revision||latest.startsAt!==selection.block.startsAt||latest.endsAt!==selection.block.endsAt));
 useUnsavedEntry('calendar-block:'+organization,dirty);useBlockedEntry('calendar-block:'+organization,busy);
 const format=(value:string)=>new Date(value).toLocaleString('en-US',{timeZone:timezone,weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 function clear(){setStart('');setEnd('');setSelection(null);}
 async function load(){const current=++generation.current;setLoading(true);setError('');try{
  const r=await sessionFetch('/api/calendar-blocks?'+new URLSearchParams({organization}),{cache:'no-store'});
  if(!r.ok){if(mounted.current&&current===generation.current&&(r.status===401||r.status===403)){setDenied(true);setAccessNeeded(true);}throw Error('UNAVAILABLE');}
  const data=calendarBlockList.parse(await r.json());if(!mounted.current||current!==generation.current)return false;
  setBlocks(data.blocks);setPage(p=>Math.min(p,Math.max(0,Math.ceil(data.blocks.length/10)-1)));setStale(false);setSyncNeeded(false);setDenied(false);setAccessNeeded(false);return true;
 }catch{if(mounted.current&&current===generation.current){setStale(true);setError('Saved time blocks could not refresh. Your entries are kept. Refresh saved blocks before making another change.');}return false;}
 finally{if(mounted.current&&current===generation.current)setLoading(false);}}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 useEffect(()=>{void load();},[revision]);
 useEffect(()=>{if(selection?.kind==='edit')startInput.current?.focus();if(selection?.kind==='remove')removeButton.current?.focus();},[selection]);
 async function send(){if(sending.current||!attempt.current)return;sending.current=true;generation.current++;setLoading(false);setPending(true);setError('');setAccessNeeded(false);setNotice('');acknowledged.current='';setStale(true);
  try{const r=await sessionFetch('/api/calendar-blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current.body});
   if(!r.ok&&r.status>=400&&r.status<500){if(mounted.current){setAccessNeeded(r.status===401||r.status===403);if(unknown){setError('The earlier block change is still unconfirmed. Keep these entries and check the same saved attempt after reviewing your access or connection.');return;}const rejected=calendarBlockRejection.safeParse(await r.json().catch(()=>null));if(!mounted.current)return;attempt.current=null;setError(rejected.success?rejected.data.error+' Your entries are kept. Refresh saved blocks before trying again.':'This block change was rejected. Your entries are kept. Refresh saved blocks and review the dates, access and appointment conflicts.');}return;}
   if(!r.ok)throw Error('UNVERIFIED');const d=await r.json(),command=attempt.current.command;validateCalendarBlockReceipt(command,d.result);if(!mounted.current)return;
   attempt.current=null;setUnknown(false);setSyncNeeded(true);clear();
   const saved=command.remove?'Time block removed. Booking availability will be checked when a time is selected.':command.id?'Time block updated. Customers see this time as unavailable.':'Time blocked. Customers see this time as unavailable.';
   setNotice(saved);acknowledged.current=command.key;const callbackFailed=()=>{if(mounted.current&&acknowledged.current===command.key)setNotice(saved+' The workspace summary could not refresh; refresh the workspace when ready.');};try{void Promise.resolve(onChanged?.()).catch(callbackFailed);}catch{callbackFailed();}
   await load();
  }catch{if(mounted.current){setUnknown(true);setError('We couldn’t confirm whether this block change saved. Keep this screen open and choose Check saved block result before changing anything else.');}}
  finally{sending.current=false;if(mounted.current)setPending(false);}
 }
 function save(remove=false){if(sending.current||locked||denied||selectionChanged)return;setError('');try{
  const parsed=calendarBlockCommand.safeParse({organization,id:selection?.block.id||null,revision:selection?.block.revision||null,start:remove?null:new Date(localInstant(start,timezone)).toISOString(),end:remove?null:new Date(localInstant(end,timezone)).toISOString(),remove,key:crypto.randomUUID()});
  if(!parsed.success){setError('Choose an end after the start, within 366 days. Check the selected block before saving.');return;}
  attempt.current={body:JSON.stringify(parsed.data),command:parsed.data};void send();
 }catch{setError('Choose valid local dates and times. A time skipped or repeated when clocks change needs another choice.');}}
 function choose(block:CalendarBlock,kind:Selection['kind']){if(locked||dirty||denied)return;setError('');setNotice('');setSelection({kind,block});if(kind==='edit'){setStart(localMinute(Date.parse(block.startsAt),timezone));setEnd(localMinute(Date.parse(block.endsAt),timezone));}}
 function discard(){if(busy||sending.current)return;if(!window.confirm('Discard these unsaved block entries? Saved time blocks will stay unchanged.'))return;clear();setError('');setNotice('Unsaved block entries discarded.');}
 return <section className="panel calendar-block-editor" aria-label="Unavailable time"><h2>Block time</h2><p>Choose a few hours or several days. Customers see this time as unavailable. Times use {timezone}.</p>
 <div className="actions"><button type="button" disabled={pending||unknown||loading} onClick={()=>void load()}>Refresh saved blocks</button>{dirty&&<button type="button" className="secondary" disabled={busy||loading} onClick={discard}>Discard unsaved block entries</button>}</div>
 {error&&<p role="alert" className="note">{error}</p>}{notice&&<p role="status">{notice}</p>}{unknown&&<button type="button" disabled={pending} onClick={()=>void send()}>{pending?'Checking saved block result…':'Check saved block result'}</button>}
 {syncNeeded&&<p role="status">The change was saved. Refresh saved blocks to reconcile this view before another change.</p>}
 {accessNeeded&&<p><a href="/owner" target="_blank" rel="noopener noreferrer">Open sign-in in another tab</a>, then return here to check access and the saved result.</p>}
 {denied?<p role="alert">Your account cannot open these time blocks. Restore access and refresh. Unfinished entries stay in this screen.</p>:<>
 {stale&&blocks&&<p role="status">This is the last saved view. Refresh before relying on these dates or making another change.</p>}
 {selection&&<section className="account-card" aria-label="Selected time block"><h3>{selection.kind==='remove'?'Remove this time block?':'Edit this time block'}</h3><p>Original: <time dateTime={selection.block.startsAt}>{format(selection.block.startsAt)}</time><br/>Until <time dateTime={selection.block.endsAt}>{format(selection.block.endsAt)}</time></p>
 {selectionChanged&&<p role="alert">This block changed or was removed in the latest calendar. Your original selection and entries are kept. Discard them when ready to review the current blocks.</p>}
 {selection.kind==='remove'&&<><p>This releases the unavailable time. It does not cancel or move an appointment.</p><div className="actions"><button ref={removeButton} type="button" disabled={locked||selectionChanged} onClick={()=>save(true)}>Confirm removal</button><button type="button" className="secondary" disabled={busy} onClick={()=>{clear();setError('');}}>Keep this block</button></div></>}
 </section>}
 {selection?.kind!=='remove'&&<form aria-label="Time block dates" onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy}><legend>{selection?'New dates':'Unavailable dates'}</legend>
 <label>From<input ref={startInput} name="start" type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
 <label>Until<input name="end" type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
 <button disabled={locked||selectionChanged||!start||!end}>{pending?'Saving block…':selection?'Save block changes':'Block this time'}</button></fieldset></form>}
 <h3>Saved unavailable time</h3>{blocks===null?<p role="status">{loading?'Loading saved blocks…':'Saved time blocks are unavailable. Refresh to try again.'}</p>:<>
 <p>{blocks.length} saved {blocks.length===1?'block':'blocks'}.</p>{!blocks.length&&<p>No unavailable time is saved.</p>}
 {blocks.slice(page*10,page*10+10).map(b=><article key={b.id} className="account-card" aria-label={'Time block '+format(b.startsAt)}><p><time dateTime={b.startsAt}>{format(b.startsAt)}</time><br/>Until <time dateTime={b.endsAt}>{format(b.endsAt)}</time></p><div className="actions"><button type="button" className="secondary" aria-label={'Edit block starting '+format(b.startsAt)} disabled={locked||dirty} onClick={()=>choose(b,'edit')}>Edit block</button><button type="button" className="secondary" aria-label={'Remove block starting '+format(b.startsAt)} disabled={locked||dirty} onClick={()=>choose(b,'remove')}>Remove block</button></div></article>)}
 {blocks.length>10&&<div className="actions"><button type="button" disabled={busy||dirty||page===0} onClick={()=>setPage(p=>p-1)}>Previous blocks</button><span>Page {page+1} of {Math.ceil(blocks.length/10)}</span><button type="button" disabled={busy||dirty||(page+1)*10>=blocks.length} onClick={()=>setPage(p=>p+1)}>Next blocks</button></div>}
 </>}
 </>}
 </section>;
}
