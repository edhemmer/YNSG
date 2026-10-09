'use client';
import {useEffect,useState} from 'react';
export const themeKey='ynsg.workspace.theme.v1';
export default function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const sync=()=>setDark(document.documentElement.dataset.theme==='dark');
  const followSystem=()=>{try{const saved=localStorage.getItem(themeKey);if(saved==='dark'||saved==='light')return;}catch{}document.documentElement.dataset.theme=media.matches?'dark':'light';sync();};
  const storage=(event:StorageEvent)=>{if(event.key===themeKey){document.documentElement.dataset.theme=event.newValue==='dark'?'dark':event.newValue==='light'?'light':media.matches?'dark':'light';sync();}};
  sync();media.addEventListener('change',followSystem);window.addEventListener('storage',storage);
  return()=>{media.removeEventListener('change',followSystem);window.removeEventListener('storage',storage);};
 },[]);
 return <button type="button" className="secondary theme-toggle" aria-label="Dark mode" aria-pressed={dark} title={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>{const next=dark?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem(themeKey,next);}catch{}setDark(next==='dark');}}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20 15.5A9 9 0 0 1 8.5 4a9 9 0 1 0 11.5 11.5Z"/>}</svg><span>{dark?'Light mode':'Dark mode'}</span></button>;
}
