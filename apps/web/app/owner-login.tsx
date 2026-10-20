"use client";
import {useState,type FormEvent} from "react";
import ThemeToggle from "./theme-toggle";
import {sessionFetch} from "../lib/session-fetch";
import {publicError} from "../lib/public-errors";

type Props={initialEmail:string;onSignedIn:()=>Promise<void>;brand:string};
export default function OwnerLogin({initialEmail,onSignedIn,brand}:Props){
 const [email,setEmail]=useState(initialEmail);
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [mode,setMode]=useState<"password"|"recovery"|"code">("password");
 const [code,setCode]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;
  setBusy(true);setError("");setInfo("");
  try{
   const body=mode==="password"?{action:"password",email,password}:mode==="recovery"?{action:"send",email,destination:"owner"}:{action:"verify",email,code:code.trim()};
   const response=await sessionFetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Unable to sign in.");
   if(mode==="recovery"){setMode("code");setInfo("Use the newest code from your email.");return;}
   setPassword("");setCode("");
   await onSignedIn();
  }catch(cause){setError(publicError(cause));}
  finally{setBusy(false);}
 }
 return <form className="auth card" onSubmit={submit} aria-label="Owner sign in">
  <ThemeToggle/>
  <p className="eyebrow">{brand}</p>
  <h1>Owner sign in</h1>
  <p>Sign in securely to manage requests and messages.</p>
  <label htmlFor="new-owner-email">Email address</label>
  <input id="new-owner-email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy||mode==="code"} value={email} onChange={e=>setEmail(e.target.value)}/>
  {mode==="password"?<>
   <label htmlFor="new-owner-password">Password</label>
   <input id="new-owner-password" type={showPassword?"text":"password"} required autoComplete="current-password" disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/>
   <button type="button" className="secondary" aria-controls="new-owner-password" aria-pressed={showPassword} disabled={busy} onClick={()=>setShowPassword(value=>!value)}>{showPassword?"Hide password":"Show password"}</button>
  </>:mode==="code"?<>
   <label htmlFor="new-owner-code">Email sign-in code</label>
   <input id="new-owner-code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} pattern="[0-9]{6,10}" disabled={busy} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,""))}/>
  </>:<p>Send one sign-in code to your email. Email delivery can be temporarily limited by your provider.</p>}
  {error&&<p role="alert">{error}</p>}
  {info&&<p role="status">{info}</p>}
  <button type="submit" disabled={busy}>{busy?"Please wait…":mode==="password"?"Sign in":mode==="recovery"?"Email a sign-in code":"Verify and sign in"}</button>
  <div className="actions">
   <button type="button" className="secondary" disabled={busy} onClick={()=>{setError("");setInfo("");setPassword("");setCode("");setMode(mode==="password"?"recovery":"password");}}>{mode==="password"?"Use email code instead":"Back to password sign in"}</button>
  </div>
 </form>;
}
