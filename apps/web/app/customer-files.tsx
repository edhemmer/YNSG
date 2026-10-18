'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
type SavedFile={id:string;name:string;purpose:string;mime:string;bytes:number;createdAt:string};
export default function CustomerFiles({organization,customer}:{organization:string;customer:string}){
 const [files,setFiles]=useState<SavedFile[]>([]),[file,setFile]=useState<File|null>(null),[purpose,setPurpose]=useState('job_photo'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const frozen=useRef<{file:File;purpose:string;key:string}|null>(null),sending=useRef(false),generation=useRef(0);
 useBlockedEntry('customer-files:'+organization+customer,busy||unknown);
 useUnsavedEntry('customer-files:'+organization+customer,Boolean(file));
 async function reload(){
  const id=++generation.current;setLoading(true);setError('');
  try{
   const r=await sessionFetch('/api/customer-files?'+new URLSearchParams({organization,customer}),{cache:'no-store'}),data=await r.json();
   if(!r.ok||!Array.isArray(data.files))throw Error('UNAVAILABLE');
   if(id!==generation.current)return;
   setFiles(data.files);if(!unknown)frozen.current=null;
  }catch{if(id===generation.current)setError('Attachments could not be verified. Refresh before adding or sharing files.');}
  finally{if(id===generation.current)setLoading(false);}
 }
 useEffect(()=>{setFiles([]);setFile(null);setUnknown(false);frozen.current=null;void reload();return()=>{generation.current++};},[organization,customer]);
 async function submit(){
  if(sending.current||busy||loading||(unknown&&!frozen.current))return;
  if(!frozen.current){
   if(!file||file.size>4194304||file.size<8||!['image/png','image/jpeg'].includes(file.type)){setError('Choose a JPG or PNG up to 4 MB.');return;}
   frozen.current={file,purpose,key:crypto.randomUUID()};
  }
  const target=frozen.current;sending.current=true;setBusy(true);setError('');setNotice('');
  const form=new FormData();form.append('organization',organization);form.append('customer',customer);form.append('key',target.key);form.append('purpose',target.purpose);form.append('file',target.file);
  try{
   const r=await sessionFetch('/api/customer-files',{method:'POST',body:form}),answer=await r.json();
   if(!r.ok){
    if(r.status>=400&&r.status<500){if(r.status!==409){frozen.current=null;setUnknown(false);}else setUnknown(true);setError(typeof answer.error==='string'?answer.error:'Attachment rejected.');return;}
    throw Error('UNCERTAIN');
   }
   if(answer.ok!==true||typeof answer.file!=='string')throw Error('UNCERTAIN');
   setFile(null);setUnknown(false);frozen.current=null;setNotice('Attachment saved. Refreshing the private file list.');await reload();
  }catch{setUnknown(true);setError('The upload result is uncertain. Review saved attachments, then retry only the same original upload attempt.');}
  finally{sending.current=false;setBusy(false);}
 }
 async function open(id:string){
  setError('');
  try{
   const r=await sessionFetch('/api/customer-files?'+new URLSearchParams({organization,file:id}),{cache:'no-store'}),data=await r.json();
   if(!r.ok||typeof data.url!=='string')throw Error('UNAVAILABLE');
   const url=new URL(data.url);
   if(url.protocol!=='https:')throw Error('UNAVAILABLE');
   window.open(url.href,'_blank','noopener,noreferrer');
  }catch{setError('The private file link could not be opened. Refresh and try again.');}
 }
 return <section className="card" aria-label="Private supporting attachments"><h3>Private photos and receipts</h3>
  <p>Visible only to authorized business owners. These files are never public marketing material.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" className="secondary" disabled={busy||loading} onClick={()=>void reload()}>{loading?'Checking saved files…':'Refresh attachments'}</button>
  {unknown&&frozen.current&&<button type="button" disabled={busy||loading} onClick={()=>void submit()}>Retry original upload safely</button>}
  <form onSubmit={e=>{e.preventDefault();void submit();}}>
   <fieldset disabled={busy||loading||unknown}><legend>Add one image</legend>
    <label>What is this image?<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="job_photo">Job photo</option><option value="receipt">Receipt</option><option value="customer_document">Customer supporting document</option></select></label>
    <label>Choose JPG or PNG, 4 MB maximum<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button type="submit" disabled={!file}>{busy?'Saving…':'Save private attachment'}</button>
   </fieldset>
  </form>
  {files.map(f=><div className="customer-item" key={f.id}><strong>{f.name}</strong> · {f.purpose.replaceAll('_',' ')} <button type="button" className="secondary" onClick={()=>void open(f.id)}>Open private file</button></div>)}
  {!loading&&!files.length&&<p>No saved attachments.</p>}
 </section>;
}
