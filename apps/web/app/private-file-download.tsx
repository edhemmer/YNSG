'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
export default function PrivateFileDownload({organization,file,disabled=false}:{organization:string;file:string;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[fallback,setFallback]=useState(''),sending=useRef(false),mounted=useRef(true),identity=organization+':'+file,current=useRef(identity);current.current=identity;
 useEffect(()=>{mounted.current=true;setFallback('');setError('');return()=>{mounted.current=false;};},[identity]);
 useEffect(()=>{if(!fallback)return;const timer=setTimeout(()=>setFallback(''),45000);return()=>clearTimeout(timer);},[fallback]);
 async function open(){if(disabled||sending.current)return;sending.current=true;setBusy(true);setError('');setFallback('');const at=identity;let popup:Window|null=null;try{popup=window.open('about:blank','_blank');if(popup)popup.opener=null;}catch{/* A blocked popup can use an explicit download link after verification. */}
  try{const r=await sessionFetch('/api/customer-files?'+new URLSearchParams({organization,file}),{cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await r.json();if(!mounted.current||current.current!==at){popup?.close();return;}if(!r.ok||typeof data.url!=='string'||data.expiresIn!==60)throw Error();const url=new URL(data.url);if(url.protocol!=='https:')throw Error();if(popup&&!popup.closed)popup.location.replace(url.href);else setFallback(url.href);}catch{popup?.close();if(mounted.current&&current.current===at)setError('The private file could not be verified. Try again.');}finally{sending.current=false;if(mounted.current&&current.current===at)setBusy(false);}
 }
 return <><button type="button" className="secondary" disabled={disabled||busy} onClick={()=>void open()}>{busy?'Verifying private file…':'Open private file'}</button>{fallback&&!disabled&&<a href={fallback} target="_blank" rel="noopener noreferrer">Download verified image</a>}{error&&<p role="alert">{error}</p>}</>;
}
