"use client";
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../../lib/session-fetch';
type Context={contacts:{id:string;customer_id:string;name:string;email:string;phone:string}[];properties:{id:string;customer_id:string;street:string;city:string;region:string}[];services:{name:string;scope:string}[]};
const jobs:Record<string,string[]>={
 'Help around the home':['Furniture assembly','Shelving and organizing','Household product setup','Lightweight hanging','Small drywall patch','Moving manageable items','Several small jobs'],
 'Lawn care':['Mowing','Trimming and edging','Mow, trim and blow-off','Leaf management','Recurring lawn care'],
 'Yard & garden':['Pulling weeds by hand','Bulk or bagged mulch pickup, delivery & spreading','Spreading mulch','Planting small bushes','Planting flowers','Small bush trimming','Garden-bed cleanup','Moving yard materials'],
 'Snow clearing':['Residential driveway','Sidewalks and walkways','Accessible entry','Driveway and walks'],
 'Concrete pressure washing':['Concrete driveway','Concrete walks','Concrete patio'],
 'Something else':['Describe below']
};
export default function RepeatRequest({organization,onSaved}:{organization:string;onSaved:()=>void}){
 const [data,setData]=useState<Context|null>(null),[property,setProperty]=useState(''),[contact,setContact]=useState(''),[selected,setSelected]=useState<{service:string;task:string}[]>([]),[description,setDescription]=useState(''),[preferredTime,setPreferredTime]=useState(''),[communityRate,setCommunityRate]=useState('No'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const activeOrg=useRef(organization);activeOrg.current=organization;
 const retry=useRef<{fingerprint:string;key:string}|null>(null);
 useEffect(()=>{let active=true;setData(null);setError('');setProperty('');setContact('');setSelected([]);setDescription('');setPreferredTime('');setCommunityRate('No');setBusy(false);setSaved(false);retry.current=null;
  sessionFetch('/api/account-request?'+new URLSearchParams({organization})).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setData(d);if(d.properties.length===1)setProperty(d.properties[0].id);if(d.contacts.length===1)setContact(d.contacts[0].id);}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false};
 },[organization]);
 const address=data?.properties.find(p=>p.id===property);
 const contacts=data?.contacts.filter(c=>c.customer_id===address?.customer_id)||[];
 const chosenContact=contacts.find(c=>c.id===contact)||(contacts.length===1?contacts[0]:undefined);
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||!address||!chosenContact||!selected.length)return;setBusy(true);setError('');const submittedOrg=organization;try{
  const input={services:selected,description,preferredTime,communityRate};const payload={organization,contact:chosenContact.id,property:address.id,input};const fingerprint=JSON.stringify(payload);
  if(retry.current?.fingerprint!==fingerprint)retry.current={fingerprint,key:crypto.randomUUID()};
  const r=await sessionFetch('/api/account-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,key:retry.current.key})});const d=await r.json();if(!r.ok||!d.request?.id)throw Error(d.error||'The saved request could not be confirmed. Try again with the same details.');
  if(activeOrg.current!==submittedOrg)return;setSaved(true);retry.current=null;onSaved();
 }catch(e){if(activeOrg.current===submittedOrg)setError((e as Error).message)}finally{if(activeOrg.current===submittedOrg)setBusy(false)}}
 return <section className="account-card" aria-label="New service request"><h2>Request service appt</h2>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading your saved details…</p>}{saved?<><p role="status">Your request is saved. We’ll contact you to confirm the work, cost and appointment.</p><button onClick={()=>{setSaved(false);setSelected([]);setDescription('');setPreferredTime('');}}>Start another request</button></>:data&&<form onSubmit={submit}><fieldset disabled={busy}>
 <legend>Your saved details</legend>{data.properties.length===1?<p>{address?.street}, {address?.city}, {address?.region}</p>:<label>Where would you like the work done?<select required value={property} onChange={e=>{setProperty(e.target.value);setContact('');}}><option value="">Choose your address</option>{data.properties.map(p=><option key={p.id} value={p.id}>{p.street}, {p.city}, {p.region}</option>)}</select></label>}
 {contacts.length>1&&<label>Contact for this visit<select required value={contact} onChange={e=>setContact(e.target.value)}><option value="">Choose contact</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
 {chosenContact&&<p>{chosenContact.name}<br/>{chosenContact.phone}<br/>{chosenContact.email}</p>}
 {!data.properties.length||!data.contacts.length?<p>Contact the business to connect your address and contact details before requesting another visit.</p>:<p>Need to change these details? Contact the business before sending.</p>}
 <p>Press or click a category to see the jobs. You can choose jobs from more than one category.</p>
 {data.services.map(s=><details key={s.name} className="repeat-category"><summary>{s.name} — Press or click to see jobs</summary><p>{s.scope}</p>{(jobs[s.name]||['Not sure yet']).map(task=>{const checked=selected.some(x=>x.service===s.name&&x.task===task);return <label key={task} className="check"><input type="checkbox" checked={checked} onChange={e=>{if(e.target.checked){if(selected.length>=15){setError('Choose up to 15 jobs. Add any others in the note.');return;}setSelected([...selected,{service:s.name,task}]);}else setSelected(selected.filter(x=>x.service!==s.name||x.task!==task));}}/>{task==='Describe below'?'Describe another job in the note below':task}</label>})}</details>)}
 <p role="status">{selected.length} jobs selected.</p>
 <label>Anything else we should know?<textarea rows={3} maxLength={3000} required={selected.some(s=>s.service==='Something else')} minLength={selected.some(s=>s.service==='Something else')?10:0} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label>A day or time that usually works? (optional)<input maxLength={180} value={preferredTime} onChange={e=>setPreferredTime(e.target.value)} placeholder="We’ll confirm a time together"/></label>
 <label>Ask about the Community Rate?<select value={communityRate} onChange={e=>setCommunityRate(e.target.value)}><option value="No">No, thanks</option><option value="Yes">Yes, please</option></select></label>
 <p>This sends a request; it doesn’t book an appointment.</p><button disabled={!address||!chosenContact||!selected.length} type="submit">{busy?'Saving your request…':'Send service request'}</button>
 </fieldset></form>}</section>;
}
