'use client';
import {useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
export default function CustomerExport({organization,customer}:{organization:string;customer:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  if(busy)return;setBusy(true);setError('');
  try{
   const r=await sessionFetch('/api/customer-export?'+new URLSearchParams({organization,customer}),{cache:'no-store'});
   if(!r.ok)throw Error('The complete customer record could not be exported. Refresh customer details and try again.');
   const bytes=await r.blob(),json=JSON.parse(await bytes.text());
   if(json.format!=='ynsg-customer-record-v1'||json.organization!==organization||json.customer?.id!==customer||!Array.isArray(json.requests)||!Array.isArray(json.history))throw Error('The customer export did not match the selected customer.');
   const url=URL.createObjectURL(new Blob([JSON.stringify(json,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='customer-record-'+customer+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:'The export could not be confirmed.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Download customer records">
  <h4>Customer record export</h4>
  <p>Download the profile, saved contacts, addresses, linked request summaries and recorded changes. Private file contents, payments and account credentials are not included.</p>
  {error&&<p role="alert">{error}</p>}
  <button className="secondary" type="button" disabled={busy} onClick={()=>void download()}>{busy?'Preparing complete record…':'Download customer record'}</button>
 </section>;
}
