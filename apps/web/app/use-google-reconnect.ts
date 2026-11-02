'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {googleReconnectUrl} from '../lib/google-reconnect';
import {googleMessages} from '../lib/google-messages';
import {useEntrySafety} from './entry-safety';
export function useGoogleReconnect(organization:string){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const flight=useRef(false),generation=useRef(0);const {canLeave}=useEntrySafety();
 useEffect(()=>{const lifecycle=generation;lifecycle.current++;setBusy(false);setMessage('');flight.current=false;return()=>{lifecycle.current++}},[organization]);
 async function reconnect(){if(flight.current||!canLeave())return;flight.current=true;setBusy(true);setMessage('Opening Google to reconnect Calendar and Gmail…');const gen=generation.current,c=new AbortController(),deadline=setTimeout(()=>c.abort(),15000);
  try{const response=await sessionFetch('/api/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'connect',organization}),signal:c.signal}),value=await response.json();if(gen!==generation.current)return;if(!response.ok)throw Error(value.error||'GOOGLE_ACTION_FAILED');window.location.assign(googleReconnectUrl(value.url,window.location.origin));}
  catch(e){if(gen===generation.current)setMessage((Object.values(googleMessages).includes(e instanceof Error?e.message:'')?(e as Error).message:googleMessages[e instanceof Error?e.message:''])||'Google could not open. Your saved connection and settings are retained. Try again or open Google setup.');}
  finally{clearTimeout(deadline);if(gen===generation.current){flight.current=false;setBusy(false)}}
 }
 return {reconnect,busy,message};
}
