'use client';
import {useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
type Comparison={status:'duplicate_in_file'|'already_present'|'proposed';name?:string;address?:string};
type Preview={previewOnly:true;customerId:string;currentRevision:number;customerNameMatches:boolean;contacts:Comparison[];properties:Comparison[];writeCount:0};
export default function CustomerImportPreview({organization,customer}:{organization:string;customer:string}){
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function review(file:File|undefined){
  setPreview(null);setError('');if(!file)return;
  if(file.size>250000||file.size<1){setError('Choose a customer JSON export smaller than 250 KB.');return;}
  setBusy(true);
  try{
   const snapshot=JSON.parse(await file.text());
   if(snapshot?.format!=='ynsg-customer-record-v1'||snapshot?.organization!==organization||snapshot?.customer?.id!==customer)
    throw Error('This file does not match the selected company and customer. Nothing was changed.');
   const r=await sessionFetch('/api/customer-import-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,customer,snapshot})}),data=await r.json();
   if(!r.ok||data?.previewOnly!==true||data?.writeCount!==0||data?.customerId!==customer||!Array.isArray(data.contacts)||!Array.isArray(data.properties))
    throw Error(typeof data?.error==='string'?data.error:'The import preview could not be confirmed.');
   setPreview(data);
  }catch(e){setError(e instanceof Error?e.message:'The customer export could not be reviewed.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Review customer import">
  <h4>Review a saved customer record</h4>
  <p>Compare a previously downloaded customer record with the current profile. This preview never overwrites customer information.</p>
  <label>Customer JSON record<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>void review(e.target.files?.[0])}/></label>
  {busy&&<p role="status">Checking customer data…</p>}
  {error&&<p role="alert">{error}</p>}
  {preview&&<div aria-live="polite">
   <p><strong>Preview only — nothing imported.</strong> Current customer revision: {preview.currentRevision}.</p>
   {!preview.customerNameMatches&&<p role="alert">The saved customer name differs from the current name. Review before any future change.</p>}
   <p>Contacts: {preview.contacts.filter(x=>x.status==='proposed').length} proposed, {preview.contacts.filter(x=>x.status==='already_present').length} present, {preview.contacts.filter(x=>x.status==='duplicate_in_file').length} repeated in file.</p>
   <p>Addresses: {preview.properties.filter(x=>x.status==='proposed').length} proposed, {preview.properties.filter(x=>x.status==='already_present').length} present, {preview.properties.filter(x=>x.status==='duplicate_in_file').length} repeated in file.</p>
   {preview.contacts.map((c,i)=><p key={'c'+i}>{c.name}: {c.status.replaceAll('_',' ')}</p>)}
   {preview.properties.map((p,i)=><p key={'p'+i}>{p.address}: {p.status.replaceAll('_',' ')}</p>)}
  </div>}
 </section>;
}
