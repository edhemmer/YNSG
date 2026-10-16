'use client';
import {useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
type Comparison={status:'duplicate_in_file'|'already_present'|'proposed';name?:string;address?:string;value:Record<string,string>};
type Preview={previewOnly:true;customerId:string;currentRevision:number;customerNameMatches:boolean;contacts:Comparison[];properties:Comparison[];writeCount:0};
export default function CustomerImportPreview({organization,customer}:{organization:string;customer:string}){
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[unknown,setUnknown]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const attempt=useRef<string|null>(null),sending=useRef(false);
 async function review(file:File|undefined){
  if(unknown||saving)return;setPreview(null);setError('');setNotice('');attempt.current=null;if(!file)return;
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
 async function importNew(){
  if(sending.current||saving||busy||!preview)return;
  if(!attempt.current){
   const contacts=preview.contacts.filter(c=>c.status==='proposed').map(c=>c.value);
   const properties=preview.properties.filter(p=>p.status==='proposed').map(p=>p.value);
   if(!contacts.length&&!properties.length){setError('No new records were selected to import.');return;}
   if(!window.confirm('Add these new contacts and addresses to this customer? Existing records will not be overwritten.'))return;
   attempt.current=JSON.stringify({organization,customer,expectedRevision:preview.currentRevision,key:crypto.randomUUID(),approved:true,contacts,properties});
  }
  sending.current=true;setSaving(true);setError('');setNotice('');
  try{
   const r=await sessionFetch('/api/customer-import',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current}),result=await r.json();
   if(!r.ok&&r.status>=400&&r.status<500&&!unknown){attempt.current=null;setError(typeof result?.error==='string'?result.error:'The import was rejected. Refresh customer records before trying again.');return;}
   if(!r.ok||result?.result?.saved!==true||result.result.customer!==customer)throw Error('unknown');
   attempt.current=null;setUnknown(false);setPreview(null);setNotice('New customer contacts and addresses were saved. Refresh the customer record to see them.');
  }catch{setUnknown(true);setError('The save outcome is not confirmed. Check the same saved attempt, not a new import.');}
  finally{sending.current=false;setSaving(false);}
 }
 return <section aria-label="Review customer import">
  <h4>Review a saved customer record</h4>
  <p>Compare a previously downloaded customer record with the current profile. This preview never overwrites customer information.</p>
  <label>Customer JSON record<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>void review(e.target.files?.[0])}/></label>
  {busy&&<p role="status">Checking customer data…</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {unknown&&<button type="button" disabled={saving} onClick={()=>void importNew()}>Check same saved import attempt</button>}
  {preview&&<div aria-live="polite">
   <p><strong>Preview only — nothing imported.</strong> Current customer revision: {preview.currentRevision}.</p>
   {!preview.customerNameMatches&&<p role="alert">The saved customer name differs from the current name. Review before any future change.</p>}
   <p>Contacts: {preview.contacts.filter(x=>x.status==='proposed').length} proposed, {preview.contacts.filter(x=>x.status==='already_present').length} present, {preview.contacts.filter(x=>x.status==='duplicate_in_file').length} repeated in file.</p>
   <p>Addresses: {preview.properties.filter(x=>x.status==='proposed').length} proposed, {preview.properties.filter(x=>x.status==='already_present').length} present, {preview.properties.filter(x=>x.status==='duplicate_in_file').length} repeated in file.</p>
   {preview.contacts.map((c,i)=><p key={'c'+i}>{c.name}: {c.status.replaceAll('_',' ')}</p>)}
   {preview.properties.map((p,i)=><p key={'p'+i}>{p.address}: {p.status.replaceAll('_',' ')}</p>)}
   <button type="button" disabled={saving||busy||unknown||!(preview.contacts.some(c=>c.status==='proposed')||preview.properties.some(p=>p.status==='proposed'))} onClick={()=>void importNew()}>{saving?'Saving selected new records…':'Import proposed new records'}</button>
  </div>}
 </section>;
}
