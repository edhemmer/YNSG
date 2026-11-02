'use client';
import {useGoogleReconnect} from './use-google-reconnect';
import {useEffect,useState} from 'react';import {sessionFetch} from '../lib/session-fetch';import {googleNoticeStatus,googleConnectionNotice} from '../lib/google-notice';
export default function GoogleConnectionNotice({organization,onSetup}:{organization:string;onSetup:()=>void}){
 const reconnect=useGoogleReconnect(organization);
 const [result,setResult]=useState<{organization:string;notice:{title:string;detail:string}|null}|null>(null),[retry,setRetry]=useState(0),[available,setAvailable]=useState(false);
 useEffect(()=>{let live=true,busy=false;const controller=new AbortController();setResult(null);setAvailable(false);
  async function read(){if(busy)return;busy=true;try{const response=await sessionFetch('/api/google?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('UNAVAILABLE');const value=googleNoticeStatus.parse(await response.json());if(live)setAvailable(value.missing.length===0);if(live)setResult({organization,notice:googleConnectionNotice(value)});}catch{if(live&&!controller.signal.aborted)setResult({organization,notice:{title:'Google connection status unavailable',detail:'We could not confirm Google Calendar or Gmail access. Open setup to check the connection.'}});}finally{busy=false;}}
  const refresh=()=>{if(document.visibilityState==='visible')void read()};void read();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[organization,retry]);
 const notice=result?.organization===organization?result.notice:null;
 if(!notice)return null;
 return <aside className="workspace-integration-notice" aria-label="Google connection notice"><div><strong>{notice.title}</strong><p>{notice.detail}</p></div>{reconnect.message&&<p role="status">{reconnect.message}</p>}<div className="actions">{available&&<button type="button" disabled={reconnect.busy} onClick={()=>void reconnect.reconnect()}>{reconnect.busy?'Opening Google…':'Reconnect Google'}</button>}<button type="button" className="secondary" disabled={reconnect.busy} onClick={onSetup}>Open Google setup</button><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>Refresh Google status</button></div></aside>;
}
