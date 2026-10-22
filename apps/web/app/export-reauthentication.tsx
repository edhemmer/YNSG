'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
export default function ExportReauthentication({organization,onConfirmed}:{organization:string;onConfirmed:()=>void}){
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const sending=useRef(false),generation=useRef(0),currentOrg=useRef(organization);currentOrg.current=organization;
 useEffect(()=>{
 // Capture ref containers so teardown invalidates the latest in-flight generation.
 const teardownGeneration=generation;const teardownSending=sending;
 generation.current++;setPassword('');setMessage('');setBusy(false);return()=>{teardownGeneration.current++;teardownSending.current=false;};},[organization]);
 async function confirm(){if(sending.current)return;sending.current=true;setBusy(true);setMessage('');const version=generation.current;const secret=password;setPassword('');
  try{const r=await sessionFetch('/api/export-reauthentication',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,password:secret})}),data=await r.json();if(version!==generation.current||currentOrg.current!==organization)return;if(!r.ok||data.confirmed!==true){setMessage(r.status===401?'Sign in to your workspace, then retry the export.':r.status===403?'Your current account cannot authorize this export.':r.status===400?'Password confirmation failed. Check it or use your normal sign-in link.':'Confirmation could not be verified. Retry the export to check your sign-in before confirming again.');return;}onConfirmed();}
  catch{if(version===generation.current&&currentOrg.current===organization)setMessage('Confirmation could not be verified. Retry the export to check your sign-in before confirming again.');}
  finally{if(version===generation.current&&currentOrg.current===organization){sending.current=false;setBusy(false);}}
 }
 return <section aria-label="Confirm export sign-in"><p>For this download, confirm your password. Your record selection stays here. If you use email links, sign into this same account in a separate tab, then retry the download here.</p><a href="/account" target="_blank" rel="noopener noreferrer">Sign into this same account in another tab</a><form onSubmit={e=>{e.preventDefault();void confirm();}}><fieldset disabled={busy}><label>Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={!password||busy}>{busy?'Confirming sign-in…':'Confirm sign-in for export'}</button></fieldset></form>{message&&<p role="status">{message}</p>}</section>;
}
