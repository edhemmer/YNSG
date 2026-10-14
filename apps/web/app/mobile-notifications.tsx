'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
type Device={id:string;revision:number;enabled:boolean;newRequests:boolean;appointments:boolean;sound:boolean;quietStart:number;quietEnd:number;updatedAt:string};
type NativeWindow=Window&{ReactNativeWebView?:{postMessage:(value:string)=>void}};
const clock=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
const minute=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3));
export default function MobileNotifications({organization,timezone,onBusy}:{organization:string;timezone:string;onBusy:(value:boolean)=>void}){
 const [devices,setDevices]=useState<Device[]>([]),[identity,setIdentity]=useState(''),[delivery,setDelivery]=useState({pending:0,accepted:0,needsAttention:0}),[configured,setConfigured]=useState(false),[native,setNative]=useState(false),[environment,setEnvironment]=useState<'sandbox'|'production'|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState(''),[reload,setReload]=useState(0);
 const [requests,setRequests]=useState(true),[appointments,setAppointments]=useState(true),[sound,setSound]=useState(false),[quiet,setQuiet]=useState(true),[quietStart,setQuietStart]=useState('21:00'),[quietEnd,setQuietEnd]=useState('07:00');
 const attempt=useRef<string|null>(null),pending=useRef<{nonce:string;organization:string;values:{newRequests:boolean;appointments:boolean;sound:boolean;quietStart:number;quietEnd:number};devices:Device[]}|null>(null),mounted=useRef(true),sending=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{onBusy(busy||uncertain);return()=>onBusy(false);},[busy,uncertain,onBusy]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);};},[]);
 useEffect(()=>{let live=true;setLoaded(false);setNative(Boolean((window as NativeWindow).ReactNativeWebView));
 void sessionFetch('/api/mobile-notifications?'+new URLSearchParams({organization}),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setDevices(d.devices);setIdentity(d.identity);setDelivery(d.delivery);setConfigured(d.configured===true);setEnvironment(d.environment);setLoaded(true);}}).catch(e=>{if(live)setMessage(publicError(e));});return()=>{live=false;};
 },[organization,reload]);
 async function saveExact(){
  if(!attempt.current||sending.current)return;sending.current=true;setBusy(true);
  try{const r=await sessionFetch('/api/mobile-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current});const d=await r.json();
   if(!r.ok){if(r.status<500&&d.uncertain!==true){attempt.current=null;setUncertain(false);}throw Error(d.error);}
   if(!Number.isInteger(d.result?.revision)||d.result?.enabled!==true)throw Error('The saved setting could not be confirmed.');
   attempt.current=null;setUncertain(false);setMessage('Phone alert choices saved for this device. Apple acceptance and phone delivery are checked separately.');setReload(n=>n+1);
  }catch(e){if(mounted.current){setUncertain(Boolean(attempt.current));setMessage(attempt.current?'The saved result is uncertain. Check the same settings before editing again.':publicError(e));}}finally{sending.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{
  const receive=(event:Event)=>{const value=(event as CustomEvent).detail,p=pending.current;if(!p||p.organization!==organization||value?.type!=='ynsg.push.reply'||value.nonce!==p.nonce)return;
   if(timer.current)clearTimeout(timer.current);pending.current=null;
   if(value.error){setBusy(false);setMessage(value.error==='permission_denied'?'Phone alerts remain off. You can enable them later in iPhone settings.':'This device needs its signed Apple notification setup. The CRM is still usable.');return;}
   if(typeof value.device!=='string'||typeof value.token!=='string'||!/^([a-f0-9]{2}){32,128}$/i.test(value.token)||value.environment!==environment){setBusy(false);setMessage('The device response could not be verified. Nothing was saved.');return;}
   const device=p.devices.find(d=>d.id===value.device);attempt.current=JSON.stringify({organization,device:value.device,revision:device?.revision||0,token:value.token,environment:value.environment,...p.values,reviewed:true,key:p.nonce});void saveExact();
  };window.addEventListener('ynsg-native-reply',receive);return()=>window.removeEventListener('ynsg-native-reply',receive);
 },[organization,environment]);
 function connect(e:React.FormEvent){e.preventDefault();if(busy||uncertain||pending.current||attempt.current||!loaded||!configured||!native||!environment||!identity)return;
  const nonce=crypto.randomUUID();pending.current={nonce,organization,values:{newRequests:requests,appointments,sound,quietStart:quiet?minute(quietStart):0,quietEnd:quiet?minute(quietEnd):0},devices};setBusy(true);setMessage('Review the iPhone permission request.');
  (window as NativeWindow).ReactNativeWebView!.postMessage(JSON.stringify({type:'ynsg.push.register',nonce,environment,scope:organization+'.'+identity}));
  timer.current=setTimeout(()=>{pending.current=null;if(mounted.current){setBusy(false);setMessage('The phone did not respond. No alert setting was saved. Try again when connected.');}},90000);
 }
 async function disable(device:Device){if(busy||uncertain)return;setBusy(true);try{const r=await sessionFetch('/api/mobile-notifications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,device:device.id,revision:device.revision})});const d=await r.json();if(!r.ok)throw Error(d.error);setMessage('Alerts stopped for that device.');setReload(n=>n+1);}catch(e){setMessage(publicError(e));}finally{setBusy(false);}}
 return <section className="card" aria-labelledby="phone-alert-heading"><p className="eyebrow">Your phone, your choice</p><h2 id="phone-alert-heading">Phone alerts</h2><p>Get a heads-up for a new request and up to 30 minutes before a confirmed visit’s reserved work starts. Customer names, addresses and invoice amounts stay inside the signed-in CRM.</p>
 {!loaded&&<p role="status">{message?'Phone settings could not load.':'Loading phone settings…'}</p>}
 {loaded&&!configured&&<p className="note">Phone alerts become available after the owner app’s Apple setup and device checks are complete.</p>}
 {loaded&&configured&&!native&&<p>Open the signed YNSG iPhone or iPad app to connect that device. You can stop an existing device’s alerts here.</p>}
 {loaded&&configured&&native&&<form onSubmit={connect}><fieldset disabled={busy||uncertain||!loaded||!configured||!native}>
 <legend>Alerts on this device</legend><label className="check"><input type="checkbox" checked={requests} onChange={e=>setRequests(e.target.checked)}/>New service requests</label><label className="check"><input type="checkbox" checked={appointments} onChange={e=>setAppointments(e.target.checked)}/>Upcoming confirmed appointments</label><label className="check"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/>Play a sound if my iPhone allows it</label><label className="check"><input type="checkbox" checked={quiet} onChange={e=>setQuiet(e.target.checked)}/>Use quiet hours ({timezone})</label>{quiet&&<div className="form-row"><label>Quiet hours start<input type="time" required value={quietStart} onChange={e=>setQuietStart(e.target.value)}/></label><label>Quiet hours end<input type="time" required value={quietEnd} onChange={e=>setQuietEnd(e.target.value)}/></label></div>}<button>Review permission & save phone alerts</button><p className="tiny">These alerts are optional. They do not confirm appointments, change invoices or record payments. Equal start/end times mean no quiet period.</p>
 </fieldset></form>}{uncertain&&<button type="button" disabled={busy} onClick={()=>void saveExact()}>Check saved alert settings</button>}
 {message&&<p role="status">{message}</p>}{!loaded&&<button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Retry phone settings</button>}
 {loaded&&devices.length>0&&<p role="status">Phone queue: {delivery.pending} waiting · {delivery.accepted} accepted by Apple · {delivery.needsAttention} need attention. Apple acceptance does not prove the alert appeared on your phone.</p>}
 {loaded&&devices.map(d=><article className="card" key={d.id}><h3>Device ending {d.id.slice(-4)}</h3><p>{d.enabled?'Connected':'Alerts stopped'} · new requests {d.newRequests?'on':'off'} · appointments {d.appointments?'on':'off'}</p><p>Quiet hours: {d.quietStart===d.quietEnd?'off':clock(d.quietStart)+'–'+clock(d.quietEnd)}</p>{d.enabled&&<button type="button" className="secondary" disabled={busy||uncertain} onClick={()=>void disable(d)}>Stop alerts on this device</button>}</article>)}
 </section>;
}
