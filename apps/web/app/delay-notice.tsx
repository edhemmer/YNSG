'use client';
import {useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
export default function DelayNotice({organization,appointment,revision,email}:{organization:string;appointment:string;revision:number;email:string}){
 const [minutes,setMinutes]=useState(10),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const attempt=useRef<{key:string;minutes:number}|null>(null);
 async function send(){if(pending)return;setPending(true);setError('');if(!attempt.current)attempt.current={key:crypto.randomUUID(),minutes};
  try{const r=await sessionFetch('/api/appointment-delay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,appointment,revision,...attempt.current})});const d=await r.json();if(!r.ok){if(r.status<500)attempt.current=null;throw Error(d.error);}setMessage('Customer email queued. Check Activity & messages for delivery status.');}
  catch(e){setError(publicError(e));}finally{setPending(false);}
 }
 return <details className="day-plan-controls"><summary>Running late? Notify customer</summary><p>A short visit update will be emailed to {email||'the customer’s saved email'}. Their booked appointment time stays unchanged.</p><label>Expected delay<select value={attempt.current?.minutes??minutes} disabled={pending||Boolean(attempt.current)} onChange={e=>setMinutes(Number(e.target.value))}>{[5,10,15,20,30,45,60].map(m=><option key={m} value={m}>{m} minutes</option>)}</select></label><p className="note">“We’re running a little behind for your service visit. We expect to arrive around [estimated arrival time]. Thank you for your patience.”</p>{error&&<p role="alert" className="error">{error}</p>}{message?<p role="status">{message}</p>:<button type="button" disabled={pending||!email} onClick={()=>void send()}>{pending?'Queuing update…':attempt.current?'Retry same update':'Send customer update'}</button>}</details>;
}
