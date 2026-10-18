'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {useBlockedEntry,useUnsavedEntry,useEntrySafety} from './entry-safety';
import {customerFileFinalize} from '../lib/customer-file-contract';
import {useCustomerFilePage} from './use-customer-file-page';
import CustomerFileLinkEditor from './customer-file-link-editor';
import PrivateFileDownload from './private-file-download';
export default function CustomerFiles(props:{organization:string;customer:string}){return <Files key={props.organization+':'+props.customer} {...props}/>;}
function Files({organization,customer}:{organization:string;customer:string}){
 const {canLeave}=useEntrySafety();
 const list=useCustomerFilePage(organization,customer,{},true),{loading,readFailed}=list,files=list.page?.files||[];
 const [file,setFile]=useState<File|null>(null),[purpose,setPurpose]=useState('job_photo'),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[linkBusy,setLinkBusy]=useState(false);
 const frozen=useRef<{file:File;purpose:string;key:string}|null>(null),sending=useRef(false),mounted=useRef(true),picker=useRef<HTMLInputElement|null>(null);
 useBlockedEntry('customer-files:'+organization+customer,busy||unknown||linkBusy);
 useUnsavedEntry('customer-files:'+organization+customer,Boolean(file));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function submit(){
  if(sending.current||busy||loading||linkBusy||readFailed||(unknown&&!frozen.current))return;
  if(!frozen.current){
   if(!file||file.size>4194304||file.size<8||!['image/png','image/jpeg'].includes(file.type)){setError('Choose a JPG or PNG up to 4 MB.');return;}
   frozen.current={file,purpose,key:crypto.randomUUID()};
  }
  const target=frozen.current;sending.current=true;setBusy(true);setError('');setNotice('');
  const form=new FormData();form.append('organization',organization);form.append('customer',customer);form.append('key',target.key);form.append('purpose',target.purpose);form.append('file',target.file);
  try{
   const r=await sessionFetch('/api/customer-files',{method:'POST',body:form,signal:AbortSignal.timeout(20000)}),answer=await r.json();if(!mounted.current)return;
   if(!r.ok){
    if(r.status>=400&&r.status<500){if(unknown||r.status===409){setUnknown(true);}else{frozen.current=null;setUnknown(false);}setError(typeof answer.error==='string'?answer.error:'Attachment rejected.');return;}
    throw Error('UNCERTAIN');
   }
   if(answer.ok!==true||!customerFileFinalize.safeParse({id:answer.file,ready:true}).success)throw Error('UNCERTAIN');
   setFile(null);if(picker.current)picker.current.value='';setUnknown(false);frozen.current=null;setNotice('Attachment saved. Refreshing the private file list.');await list.reset();
  }catch{if(!mounted.current)return;setUnknown(true);setError('The upload result is uncertain. Review saved attachments, then retry only the same original upload attempt.');}
  finally{sending.current=false;if(mounted.current)setBusy(false);}
 }
 return <section className="card" aria-label="Private supporting attachments"><h3>Private photos and receipts</h3>
  <p>Visible only to authorized business owners. These files are never public marketing material.</p>
  {(error||list.error)&&<p role="alert">{error||list.error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" className="secondary" disabled={busy||loading||linkBusy} onClick={()=>void list.retry()}>{loading?'Checking saved files…':readFailed?'Retry attachment page':'Refresh attachments'}</button>
  {unknown&&frozen.current&&<button type="button" disabled={busy||loading||readFailed||linkBusy} onClick={()=>void submit()}>Retry original upload safely</button>}
  <form onSubmit={e=>{e.preventDefault();void submit();}}>
   <fieldset disabled={busy||loading||unknown||linkBusy||readFailed}><legend>Add one image</legend>
    <label>What is this image?<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="job_photo">Job photo</option><option value="receipt">Receipt</option><option value="customer_document">Customer supporting document</option></select></label>
    <label>Choose JPG or PNG, 4 MB maximum<input ref={picker} type="file" accept="image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button type="submit" disabled={!file}>{busy?'Saving…':'Save private attachment'}</button>
   </fieldset>
  </form>
  {list.page&&<nav className="actions" aria-label="Attachment pages"><button type="button" className="secondary" disabled={!list.index||busy||unknown||linkBusy||loading||readFailed} onClick={()=>{if(canLeave())void list.previous();}}>Previous attachments</button><span role="status">Page {list.index+1} · {files.length} attachments</span><button type="button" className="secondary" disabled={!list.page.hasMore||busy||unknown||linkBusy||loading||readFailed} onClick={()=>{if(canLeave())void list.next();}}>Next attachments</button></nav>}
  {files.map(f=><div className="customer-item" key={f.id}><strong>{f.name}</strong> · {f.purpose.replaceAll('_',' ')} <PrivateFileDownload key={organization+':'+f.id} organization={organization} file={f.id} disabled={busy||unknown||linkBusy||loading||readFailed}/>{<CustomerFileLinkEditor key={f.id} organization={organization} customer={customer} file={f} saved={list.refresh} busy={setLinkBusy} disabled={busy||unknown||loading||readFailed||linkBusy}/>}</div>)}
  {!loading&&!readFailed&&!files.length&&<p>{list.index?"No attachments on this page.":"No saved attachments."}</p>}
 </section>;
}
