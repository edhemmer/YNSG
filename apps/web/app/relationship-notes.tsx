'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {noteCommand,noteSaved,noteList} from '../lib/relationship-note-contract';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
type Props={organization:string;type:'request'|'customer';target:string;timezone:string};
type Note={id:string;body:string;created_at:string;request_id:string|null};
export default function RelationshipNotes(props:Props){return <NotesEditor key={props.organization+':'+props.type+':'+props.target} {...props}/>;}
function NotesEditor({organization,type,target,timezone}:Props){
 const [open,setOpen]=useState(false),[notes,setNotes]=useState<Note[]>([]),[body,setBody]=useState(''),[pending,setPending]=useState(false),[unknown,setUnknown]=useState(false),[accessNeeded,setAccessNeeded]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false);
 const sequence=useRef(0),attempt=useRef<string|null>(null),sending=useRef(false),mounted=useRef(true),locked=pending||unknown,region=`notes-${type}-${target}`;
 useUnsavedEntry(region,body.trim().length>0);useBlockedEntry(region,locked);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;};},[]);
 async function reload(readPage=page){
  const current=++sequence.current;setLoading(true);setError('');
  try{const response=await sessionFetch('/api/notes?'+new URLSearchParams({organization,type,target,page:String(readPage)}),{cache:'no-store'});if(!response.ok)throw Error('UNAVAILABLE');const result=noteList.parse(await response.json());if(result.page!==readPage)throw Error('UNVERIFIED');if(mounted.current&&sequence.current===current){setNotes(result.notes);setHasMore(result.hasMore);}}
  catch{if(mounted.current&&sequence.current===current)setError('Notes could not refresh. Your entries and current history are kept. Try Refresh notes.');}
  finally{if(mounted.current&&sequence.current===current)setLoading(false);}
 }
 useEffect(()=>{if(open)void reload();return()=>{sequence.current++;};},[open,page]);
 async function send(){
  if(sending.current||!attempt.current)return;sending.current=true;setPending(true);setError('');setMessage('');setAccessNeeded(false);
  try{const response=await sessionFetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current});
   if(!response.ok&&response.status>=400&&response.status<500){if(mounted.current){if(unknown){setAccessNeeded(response.status===401||response.status===403);setError('The earlier save is still unconfirmed. Your text is kept. Restore your access, then choose Check saved note again.');return;}attempt.current=null;setUnknown(false);setError(response.status===401||response.status===403?'Your account cannot save this note. Your text is kept; sign in or review your access.':'The note was rejected. Your text is kept. Review the selected record and note before saving again.');}return;}
   if(!response.ok)throw Error('UNVERIFIED');const result=await response.json();if(result.ok!==true)throw Error('UNVERIFIED');noteSaved.parse(result.result);if(!mounted.current)return;
   attempt.current=null;setUnknown(false);setBody('');setMessage('Note saved. Only your business can see it.');
   // A subsequent read failure cannot turn the confirmed append into an uncertain save.
   if(page!==0)setPage(0);else await reload(0);
  }catch{if(mounted.current){setUnknown(true);setError('We couldn’t confirm whether this note saved. Keep this screen open and choose Check saved note before changing it.');}}
  finally{sending.current=false;if(mounted.current)setPending(false);}
 }
 function save(event:FormEvent){event.preventDefault();if(sending.current||locked)return;const parsed=noteCommand.safeParse({organization,type,target,body,key:crypto.randomUUID()});if(!parsed.success){setError('Enter a note of 1–4000 characters.');return;}attempt.current=JSON.stringify(parsed.data);void send();}
 return <section aria-label="Owner notes">
  <button type="button" className="secondary" disabled={locked} aria-expanded={open} aria-controls={region} onClick={()=>setOpen(!open)}>{open?'Close notes':'Conversation notes'}</button>
  {open&&<div id={region} className="card"><h3>{type==='customer'?'Customer conversation history':'Request conversation notes'}</h3><p className="muted">For your business records. These notes are not shown in the customer account.</p>
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{accessNeeded&&<p><a href="/owner" target="_blank" rel="noopener noreferrer">Open sign-in in another tab</a>, then return here to check this saved attempt.</p>}{unknown&&<button type="button" disabled={pending} onClick={()=>void send()}>{pending?'Checking saved note…':'Check saved note'}</button>}
   <form onSubmit={save}><label htmlFor={`${region}-body`}>Add a note</label><textarea id={`${region}-body`} required disabled={locked} maxLength={4000} rows={3} value={body} onChange={e=>{setBody(e.target.value);setMessage('');}}/><button disabled={locked||!body.trim()}>{pending?'Saving…':'Save note'}</button></form>
   {loading?<p role="status">Loading notes…</p>:notes.length?notes.map(note=><article className="row" key={note.id}><time dateTime={note.created_at}>{new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(note.created_at))}</time>{type==='customer'&&note.request_id&&<p className="tiny">From a linked service request</p>}<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{note.body}</p></article>):<p>No notes on this page.</p>}
   <div className="actions"><button type="button" className="secondary" disabled={locked||loading||page===0} onClick={()=>setPage(page-1)}>Previous notes</button><button type="button" className="secondary" disabled={locked||loading||!hasMore} onClick={()=>setPage(page+1)}>More notes</button><button type="button" className="secondary" disabled={locked||loading} onClick={()=>{if(!sending.current)void reload();}}>Refresh notes</button></div>
  </div>}
 </section>;
}
