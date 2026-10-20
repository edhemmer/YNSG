"use client";
import {useRef,useState,type FormEvent} from "react";
import ThemeToggle from "./theme-toggle";
import {sessionFetch} from "../lib/session-fetch";
import {publicError} from "../lib/public-errors";

type Props={initialEmail:string;onSignedIn:()=>Promise<void>;brand:string};
export default function OwnerLogin({initialEmail,onSignedIn,brand}:Props){
 const inFlight=useRef(false);
 const [email,setEmail]=useState(initialEmail);
 const [password,setPassword]=useState("");
 const [visible,setVisible]=useState(false);
 const [mode,setMode]=useState<"password"|"recover">("password");
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:FormEvent){
  event.preventDefault();if(inFlight.current||sent)return;
  inFlight.current=true;
  setBusy(true);setError("");
  try{
   const body=mode==="password"?{action:"password",email,password}:{action:"recover",email};
   const response=await sessionFetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Unable to sign in.");
   if(mode==="recover"){setSent(true);return;}
   setPassword("");setVisible(false);
   await onSignedIn();
  }catch(cause){setError(publicError(cause));}
  finally{inFlight.current=false;setBusy(false);}
 }
 function changeMode(){setError("");setPassword("");setVisible(false);setSent(false);setMode(mode==="password"?"recover":"password");}
 return <form className="auth card" onSubmit={submit} aria-label="Owner sign in" aria-busy={busy}>
  <ThemeToggle/>
  <p className="eyebrow">{brand}</p>
  <h1>{mode==="password"?"Owner sign in":"Reset your password"}</h1>
  <p>{mode==="password"?"Sign in once on your own device. Your saved sign-in renews automatically until you sign out or it expires.":"Request a password reset email, then open its newest link in this browser to choose your password."}</p>
  <label htmlFor="new-owner-email">Email address</label>
  <input id="new-owner-email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy||sent} value={email} onChange={e=>setEmail(e.target.value)}/>
  {mode==="password"&&<>
   <label htmlFor="new-owner-password">Password</label>
   <input id="new-owner-password" type={visible?"text":"password"} required maxLength={128} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/>
   <button type="button" className="secondary" aria-controls="new-owner-password" aria-pressed={visible} disabled={busy} onClick={()=>setVisible(v=>!v)}>{visible?"Hide":"Show"} password</button>
  </>}
  {error&&<p role="alert">{error}</p>}
  {sent&&<p role="status">Password reset requested. Open the newest reset email in this browser. If it does not arrive, check spam before requesting another.</p>}
  <button type="submit" disabled={busy||sent}>{busy?"Please wait…":mode==="password"?"Sign in":sent?"Reset email requested":"Send password reset"}</button>
  <div className="actions"><button type="button" className="secondary" disabled={busy} onClick={changeMode}>{mode==="password"?"Forgot password":"Back to sign in"}</button></div>
  {mode==="password"&&<p className="tiny">Use a private device for saved access. Sign out when using a shared device.</p>}
 </form>;
}
