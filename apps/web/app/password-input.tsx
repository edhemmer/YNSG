'use client';
import {useEffect,useState} from 'react';
export default function PasswordInput({id,name,label,confirm=false,newPassword=false}:{id:string;name:string;label:string;confirm?:boolean;newPassword?:boolean}){
 const [visible,setVisible]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 return <div className="access-password">
  <label htmlFor={id}>{label}</label>
  <input id={id} name={name} type={visible?'text':'password'} required minLength={newPassword?10:1} maxLength={128} autoComplete={newPassword?'new-password':'current-password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" enterKeyHint={newPassword&&!confirm?'next':'go'}/>
  <button type="button" className="secondary access-visibility" aria-controls={id} aria-pressed={visible} disabled={!ready} onClick={()=>setVisible(v=>!v)}>{visible?'Hide':'Show'} {confirm?'confirmation':'password'}</button>
 </div>;
}
