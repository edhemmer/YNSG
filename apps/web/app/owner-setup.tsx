"use client";
import {useEffect,useState,type FormEvent} from 'react';
type Factor={factorId:string;enrolled:boolean;qr?:string;secret?:string};
async function call(path:string,body?:unknown){
 const response=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Setup could not be completed.');return data;
}
export default function OwnerSetup({onComplete}:{onComplete:()=>Promise<void>}){
 const [eligible,setEligible]=useState<boolean|null>(null),[factor,setFactor]=useState<Factor|null>(null),[code,setCode]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;call('/api/owner-setup').then(data=>{if(active)setEligible(data.eligible);}).catch(()=>{if(active)setError('Unable to check your setup invitation. Reload to try again.');});return()=>{active=false;};},[]);
 async function prepare(){setPending(true);setError('');try{setFactor(await call('/api/mfa',{action:'prepare'}));}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 async function claim(event:FormEvent){event.preventDefault();setPending(true);setError('');try{
  await call('/api/mfa',{action:'verify',factorId:factor!.factorId,code});
  setCode('');setFactor(null);
  await call('/api/owner-setup',{action:'claim'});
  await onComplete();
 }catch(e){setError((e as Error).message);}finally{setPending(false);}}
 return <div className="card"><h1>{eligible?'Finish owner setup':'Your account is verified.'}</h1>
 {error&&<p role="alert">{error}</p>}
 {eligible===null&&!error&&<p>Checking your setup invitation…</p>}
 {eligible===false&&<p>No company has been shared with this account. An authorized administrator must grant access.</p>}
 {eligible&&<><p>Your owner invitation requires authenticator verification. This creates your protected workspace; customer notifications remain disabled.</p>
 {!factor&&<button disabled={pending} onClick={prepare}>Set up or verify owner authenticator</button>}
 {factor&&<form onSubmit={claim}><h2>Verify your authenticator</h2>
 {!factor.enrolled&&<><p>Scan this QR code with your authenticator app. Keep the setup key private.</p>
 {factor.qr&&<img className="qr" alt="Authenticator setup QR code" src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(factor.qr)}/>}
 <details><summary>Enter the key manually</summary><code>{factor.secret}</code></details></>}
 <label htmlFor="owner-code">Six-digit authenticator code</label><input id="owner-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)}/>
 <button disabled={pending}>Verify and finish owner setup</button></form>}</>}
 </div>;
}
