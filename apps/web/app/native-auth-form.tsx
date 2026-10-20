'use client';
import {useEffect,useRef,type ReactNode} from 'react';
// Native navigation owns submission. JS only prevents a second tap; credential
// values are never read or copied into React state, fetch, storage or a URL.
export default function NativeAuthForm({children,label}:{children:ReactNode;label:string}){
 const form=useRef<HTMLFormElement>(null),sending=useRef(false);
 useEffect(()=>{const restore=()=>{sending.current=false;form.current?.removeAttribute('aria-busy');form.current?.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach(b=>{b.disabled=false;});};window.addEventListener('pageshow',restore);return()=>window.removeEventListener('pageshow',restore);},[]);
 return <form ref={form} method="post" action="/auth/access" aria-label={label} onSubmit={event=>{if(sending.current){event.preventDefault();return;}sending.current=true;event.currentTarget.setAttribute('aria-busy','true');event.currentTarget.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach(b=>{b.disabled=true;});}}>{children}</form>;
}
