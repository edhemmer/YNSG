'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {exportAuthorization} from '../lib/export-reauthentication';
import ExportReauthentication from './export-reauthentication';
export default function ProtectedDownload({organization,filename,label,disabled=false,url,download}:{organization:string;filename:string;label:string;disabled?:boolean;url?:string;download?:()=>void}){
 const [busy,setBusy]=useState(false),[reauth,setReauth]=useState(false),[message,setMessage]=useState(''),sending=useRef(false),inFlight=useRef<AbortController|null>(null),version=useRef(0),latest=useRef({organization,filename,url,disabled,download});latest.current={organization,filename,url,disabled,download};
 useEffect(()=>{version.current++;setReauth(false);setMessage('');setBusy(false);return()=>{version.current++;inFlight.current?.abort();inFlight.current=null;sending.current=false;};},[organization,filename,url,disabled]);
 async function run(){if(sending.current||disabled)return;const generation=version.current,target={organization,filename,url},controller=new AbortController();inFlight.current=controller;sending.current=true;setBusy(true);setMessage('');
  const current=()=>generation===version.current&&!latest.current.disabled&&latest.current.organization===target.organization&&latest.current.filename===target.filename&&latest.current.url===target.url;
  try{const auth=await sessionFetch('/api/export-authorization?'+new URLSearchParams({organization}),{signal:controller.signal});if(!current())return;if(auth.status===428){setReauth(true);setMessage('Confirm your sign-in, then retry this download.');return;}if(auth.status===401||auth.status===403){setMessage(auth.status===401?'Sign in to your workspace, then retry this download.':'Your current account cannot export these records.');return;}if(!auth.ok)throw Error('DENIED');const proof=exportAuthorization.parse(await auth.json());if(proof.organization!==organization||!current())throw Error('UNVERIFIED');setReauth(false);
   if(!url){latest.current.download?.();return;}
   const r=await sessionFetch(url,{signal:controller.signal});if(!current())return;if(r.status===428){setReauth(true);setMessage('Confirm your sign-in, then retry this download.');return;}if(!r.ok||!r.headers.get('content-type')?.startsWith('text/csv'))throw Error('UNVERIFIED');const bytes=await r.blob();if(!current()||bytes.size>20*1024*1024)throw Error('UNVERIFIED');const object=URL.createObjectURL(bytes);try{const a=document.createElement('a');a.href=object;a.download=filename;a.click();}finally{setTimeout(()=>URL.revokeObjectURL(object),1000);}
  }catch{if(current())setMessage('The export could not be authorized and verified. No file was downloaded.');}
  finally{if(inFlight.current===controller){inFlight.current=null;sending.current=false;if(generation===version.current)setBusy(false);}}
 }
 return <div><button type="button" className="secondary" disabled={disabled||busy} onClick={()=>void run()}>{busy?'Preparing download…':label}</button>{message&&<p role="status">{message}</p>}{reauth&&<ExportReauthentication organization={organization} onConfirmed={()=>{setReauth(false);setMessage('Sign-in confirmed. Retry the selected download.');}}/>}</div>;
}
