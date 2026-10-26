'use client';
import {useRef,useState} from 'react';
import {postalCodesForCity} from '../../../../site/city-postal-codes.js';
import {customerProfileCommand,customerProfileReceipt} from '../../lib/customer-profile-contract';
import {sessionFetch} from '../../lib/session-fetch';
import {useBlockedEntry,useUnsavedEntry} from '../entry-safety';
export default function CustomerProfile({email,onSaved}:{email:string;onSaved:()=>Promise<void>}){
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[street,setStreet]=useState(''),[city,setCity]=useState(''),[postalCode,setPostalCode]=useState('');
 const [busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const attempt=useRef<string|null>(null),sending=useRef(false);
 useUnsavedEntry('customer-profile',!saved&&Boolean(name||phone||street||city));
 useBlockedEntry('customer-profile',busy||unknown);
 async function send(){
  if(sending.current||!attempt.current)return;
  sending.current=true;setBusy(true);setError('');
  try{
   const r=await sessionFetch('/api/account-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:attempt.current});
   const result=await r.json();
   if(!r.ok){
    if(r.status>=400&&r.status<500&&!unknown){attempt.current=null;setError(typeof result.error==='string'?result.error:'Check your details.');return;}
    throw Error('UNKNOWN');
   }
   customerProfileReceipt.parse(result);attempt.current=null;setUnknown(false);setSaved(true);
   try{await onSaved();}catch{setError('Your details are saved. Reload your account to continue.');}
  }catch{setUnknown(true);setError('We could not confirm whether your details were saved. Keep this page open and check the same saved attempt.');}
  finally{sending.current=false;setBusy(false);}
 }
 function submit(event:React.FormEvent){event.preventDefault();if(sending.current||unknown||saved)return;
  const parsed=customerProfileCommand.safeParse({key:crypto.randomUUID(),profile:{name,phone,street,city,postalCode}});
  if(!parsed.success){setError('Check your name, phone, street, city and ZIP code.');return;}
  attempt.current=JSON.stringify(parsed.data);void send();
 }
 return <section className="account-card" aria-label="Your service details"><h2>Save your service details</h2><p>Add your contact and address once to request visits from your account. Earlier work is connected separately by an invitation from the business.</p>
 {error&&<p role="alert">{error}</p>}{unknown&&<button type="button" disabled={busy} onClick={()=>void send()}>{busy?'Checking saved details…':'Check saved details result'}</button>}
 {saved?<p role="status">Your details are saved.</p>:<form onSubmit={submit}><fieldset disabled={busy||unknown}><legend>Your contact and service address</legend>
 <p>Account email: {email}</p>
 <label>Name<input required autoComplete="name" minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Phone<input required type="tel" autoComplete="tel" minLength={7} maxLength={35} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label>Street address<input required autoComplete="street-address" minLength={5} maxLength={200} value={street} onChange={e=>setStreet(e.target.value)}/></label>
 <label htmlFor="profile-city">City</label><select id="profile-city" required autoComplete="address-level2" value={city} onChange={e=>{setCity(e.target.value);setPostalCode('');}}><option value="">Choose your city</option>{['DeKalb','Sycamore','Cortland'].map(c=><option key={c}>{c}</option>)}</select>
 <label htmlFor="profile-postal">ZIP code</label><select id="profile-postal" required autoComplete="postal-code" value={postalCode} onChange={e=>setPostalCode(e.target.value)}><option value="">Choose ZIP code</option>{postalCodesForCity(city).map(c=><option key={c}>{c}</option>)}</select>
 <p>We do not collect or store card numbers, security codes or bank account details.</p><button type="submit">{busy?'Saving details…':'Save details and continue'}</button></fieldset></form>}</section>;
}
