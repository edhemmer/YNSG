'use client';
import {useCallback,useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {homeProfileCommand,homeProfileRead,homeProfileSaved,homeProfileLimits,emptyHomeProfile,hasHomeProfile,type HomeProfile as Profile} from '../lib/home-profile-contract';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';

type Props={organization:string;customer:string;editable?:boolean};
const fields=[
 ['accessNotes','Getting in','Gate, door, lockbox or where to knock. Keep codes here only if the customer gave them to you.'],
 ['pets','Pets','Names, temperament, keep inside or out.'],
 ['parking','Parking','Where to park the truck and trailer.'],
 ['preferences','Preferences','Text before arriving, quiet hours, what they care about most.'],
] as const;

// Owner-only "before you arrive" details. Never shown to customers.
export default function HomeProfile(props:Props){return <HomeProfileCard key={props.organization+':'+props.customer} {...props}/>;}
function HomeProfileCard({organization,customer,editable=true}:Props){
 const id=useId(),[profile,setProfile]=useState<Profile|null>(null),[draft,setDraft]=useState<Profile>(emptyHomeProfile),[editing,setEditing]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false),[unknown,setUnknown]=useState(false);
 const attempt=useRef<string|null>(null),mounted=useRef(true),region='home-profile-'+customer;
 const dirty=editing&&profile!==null&&fields.some(([k])=>draft[k]!==profile[k]);
 useUnsavedEntry(region,dirty);useBlockedEntry(region,pending||unknown);
 const load=useCallback(async()=>{
  setError('');
  try{const r=await sessionFetch('/api/home-profile?'+new URLSearchParams({organization,customer}),{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);const p=homeProfileRead.parse(d.profile);if(mounted.current){setProfile(p);setDraft(p);}}
  catch(e){if(mounted.current)setError(e instanceof Error&&e.message?e.message:'Could not load the home profile.');}
 },[organization,customer]);
 useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[load]);
 async function send(){
  if(!attempt.current)return;setPending(true);setError('');
  try{
   const r=await sessionFetch('/api/home-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current}),d=await r.json();
   if(r.status>=500)throw Error('UNKNOWN');if(!r.ok){attempt.current=null;setUnknown(false);setError(d.error);return;}
   const saved=homeProfileSaved.parse(d.result);attempt.current=null;setUnknown(false);
   if(mounted.current){setProfile({...draft,revision:saved.revision,updatedAt:new Date().toISOString()});setEditing(false);setMessage('Home profile saved.');}
  }catch{if(mounted.current){setUnknown(true);setError('We could not confirm the save. Check again before changing anything.');}}
  finally{if(mounted.current)setPending(false);}
 }
 function save(event:FormEvent){
  event.preventDefault();if(!profile||pending||unknown)return;
  const parsed=homeProfileCommand.safeParse({organization,customer,revision:profile.revision,key:crypto.randomUUID().replaceAll('-',''),fields:{accessNotes:draft.accessNotes,pets:draft.pets,parking:draft.parking,preferences:draft.preferences}});
  if(!parsed.success){setError('Check the lengths of the home profile details.');return;}
  attempt.current=JSON.stringify(parsed.data);void send();
 }
 if(!profile)return <section className="card home-profile" aria-label="Home profile">{error?<p role="alert">{error}</p>:<p role="status">Loading home profile…</p>}</section>;
 return <section className="card home-profile" aria-label="Home profile">
  <div className="home-profile-head"><h3>Before you arrive</h3>{editable&&!editing&&<button type="button" className="secondary" onClick={()=>{setDraft(profile);setEditing(true);setMessage('');}}>{hasHomeProfile(profile)?'Edit':'Add details'}</button>}</div>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {unknown&&<button type="button" disabled={pending} onClick={()=>void send()}>{pending?'Checking…':'Check saved home profile'}</button>}
  {!editing?(hasHomeProfile(profile)?<dl className="home-profile-list">{fields.map(([k,label])=>profile[k]?<div key={k}><dt>{label}</dt><dd>{profile[k]}</dd></div>:null)}</dl>:<p className="muted">No home details yet. Add how to get in, pets, parking and preferences so every visit feels personal.</p>)
  :<form onSubmit={save} className="home-profile-form">{fields.map(([k,label,hint])=><label key={k} htmlFor={id+k}>{label}<span className="tiny">{hint}</span><textarea id={id+k} rows={k==='preferences'?3:2} maxLength={homeProfileLimits[k]} value={draft[k]} disabled={pending||unknown} onChange={e=>{const v=e.target.value;setDraft(d=>({...d,[k]:v}));}}/></label>)}
   <div className="home-profile-actions"><button disabled={pending||unknown||!dirty}>{pending?'Saving…':'Save home profile'}</button><button type="button" className="secondary" disabled={pending||unknown} onClick={()=>{setDraft(profile);setEditing(false);setError('');}}>Cancel</button></div>
   <p className="tiny">Private to your business. Never shown in the customer account.</p></form>}
 </section>;
}
