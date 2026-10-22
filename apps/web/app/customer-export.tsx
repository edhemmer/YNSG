'use client';
import {verifiedCustomerExport} from '../lib/customer-export-contract';
import ExportReauthentication from './export-reauthentication';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
export default function CustomerExport({organization,customer}:{organization:string;customer:string}){
 const current=useRef(organization+':'+customer),generation=useRef(0),sending=useRef(false),inFlight=useRef<AbortController|null>(null);current.current=organization+':'+customer;
 useEffect(()=>{
 // Capture ref containers so teardown invalidates the latest in-flight generation.
 const teardownGeneration=generation;const teardownInFlight=inFlight;const teardownSending=sending;
 generation.current++;setBusy(false);setError('');setReauth(false);return()=>{teardownGeneration.current++;teardownInFlight.current?.abort();teardownInFlight.current=null;teardownSending.current=false;};},[organization,customer]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reauth,setReauth]=useState(false);
 async function download(){
  if(sending.current||busy)return;const target=organization+':'+customer,attemptGeneration=generation.current,controller=new AbortController();inFlight.current=controller;sending.current=true;setBusy(true);setError('');
  try{
   const r=await sessionFetch('/api/customer-export?'+new URLSearchParams({organization,customer}),{cache:'no-store',signal:controller.signal});
   if(r.status===428){if(current.current===target&&generation.current===attemptGeneration){setReauth(true);setError('Confirm your sign-in, then retry this download.');}return;}
   if(r.status===401)throw Error('Sign in to your workspace, then retry this download.');
   if(r.status===403)throw Error('Your current account cannot export this customer.');
   if(!r.ok)throw Error('The complete customer record could not be exported. Refresh customer details and try again.');
   const bytes=await r.blob();if(current.current!==target||generation.current!==attemptGeneration)return;
   const json=verifiedCustomerExport(JSON.parse(await bytes.text()),{organization,customer});
   if(current.current!==target||generation.current!==attemptGeneration)return;
   setReauth(false);const url=URL.createObjectURL(new Blob([JSON.stringify(json,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='customer-record-'+customer+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){if(current.current!==target||generation.current!==attemptGeneration)return;setError(e instanceof Error&&['Sign in to your workspace, then retry this download.','Your current account cannot export this customer.','The complete customer record could not be exported. Refresh customer details and try again.'].includes(e.message)?e.message:'The complete customer record could not be verified. No file was downloaded.');}
  finally{if(inFlight.current===controller){inFlight.current=null;sending.current=false;if(current.current===target&&generation.current===attemptGeneration)setBusy(false);}}
 }
 return <section aria-label="Download customer records">
  <h4>Customer record export</h4>
  <p>Download the profile, saved contacts, addresses, linked request summaries and recorded changes. Private file contents, payments and account credentials are not included.</p>
  {error&&<p role="alert">{error}</p>}{reauth&&<ExportReauthentication organization={organization} onConfirmed={()=>{setReauth(false);setError('Sign-in confirmed. Retry the customer record download.');}}/>}
  <button className="secondary" type="button" disabled={busy} onClick={()=>void download()}>{busy?'Preparing complete record…':'Download customer record'}</button>
 </section>;
}
