'use client';
import ExportReauthentication from './export-reauthentication';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {accountingQuery,accountingCsv} from '../lib/accounting-export-contract';
export default function AccountingExport({organization,from,to,disabled}:{organization:string;from:string;to:string;disabled:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reauth,setReauth]=useState(false),sending=useRef(false),generation=useRef(0),inFlight=useRef<AbortController|null>(null);
 const identity=organization+':'+from+':'+to,currentIdentity=useRef(identity);currentIdentity.current=identity;
 useEffect(()=>{generation.current++;setMessage('');setReauth(false);setBusy(false);return()=>{generation.current++;inFlight.current?.abort();inFlight.current=null;sending.current=false;};},[organization,from,to]);
 async function download(){
  if(disabled||sending.current)return;const query=accountingQuery.safeParse({organization,from,to});if(!query.success){setMessage('Choose a date range of up to 366 days.');return;}
  sending.current=true;setBusy(true);setMessage('');const current=generation.current,target=identity,controller=new AbortController();inFlight.current=controller;
  try{const r=await sessionFetch('/api/accounting-export?'+new URLSearchParams(query.data),{signal:controller.signal}),data=await r.json();if(current!==generation.current||currentIdentity.current!==target)return;if(r.status===428){setReauth(true);setMessage('Confirm your sign-in, then retry this download.');return;}if(!r.ok){setMessage(typeof data.error==='string'&&data.error.length<=500?data.error:'Export unavailable.');return;}setReauth(false);const csv=accountingCsv(data,query.data);const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));try{const a=document.createElement('a');a.href=url;a.download=`accounting-journal-${from}-to-${to}.csv`;a.click();setMessage('Complete balanced journal downloaded. This is not a tax return or QuickBooks connection.');}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}}
  catch(e){if(current===generation.current&&currentIdentity.current===target)setMessage('The complete balanced journal could not be verified. No file was downloaded.');}
  finally{if(inFlight.current===controller){inFlight.current=null;sending.current=false;if(current===generation.current&&currentIdentity.current===target)setBusy(false);}}
 }
 return <div><button type="button" className="secondary" disabled={disabled||busy} onClick={()=>void download()}>{busy?'Preparing complete journal…':'Download accounting journal CSV'}</button><p className="tiny">Transaction-level debits and credits, including receipt corrections, in company business dates. This is not an income-tax calculation or QuickBooks integration.</p>{message&&<p role="status">{message}</p>}{reauth&&<ExportReauthentication organization={organization} onConfirmed={()=>{setReauth(false);setMessage('Sign-in confirmed. Retry the selected journal download.');}}/>}</div>;
}
