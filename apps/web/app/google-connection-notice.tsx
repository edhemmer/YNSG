'use client';
import {useEffect,useState} from 'react';import {sessionFetch} from '../lib/session-fetch';import {googleNoticeStatus,googleConnectionNotice} from '../lib/google-notice';
export default function GoogleConnectionNotice({organization,onSetup}:{organization:string;onSetup:()=>void}){
 const [result,setResult]=useState<{organization:string;notice:{title:string;detail:string}|null}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true,busy=false;const controller=new AbortController();setResult(null);
  async function read(){if(busy)return;busy=true;try{const response=await sessionFetch('/api/google?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('UNAVAILABLE');const value=googleNoticeStatus.parse(await response.json());if(live)setResult({organization,notice:googleConnectionNotice(value)});}catch{if(live&&!controller.signal.aborted)setResult({organization,notice:{title:'Google connection status unavailable',detail:'We could not confirm Google Calendar or Gmail access. Open setup to check the connection.'}});}finally{busy=false;}}
  const refresh=()=>{if(document.visibilityState==='visible')void read()};void read();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[organization,retry]);
 const notice=result?.organization===organization?result.notice:null;
 if(!notice)return null;
 return <aside className="workspace-integration-notice" aria-label="Google connection notice"><div><strong>{notice.title}</strong><p>{notice.detail}</p></div><div className="actions"><button type="button" onClick={onSetup}>Open Google setup</button><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>Refresh Google status</button></div></aside>;
}
