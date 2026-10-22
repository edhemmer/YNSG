'use client';
import {useRef,useState} from 'react';
import {useBlockedEntry} from './entry-safety';
/** Keep a field decision and its exact parent-owned retry key until acknowledged. */
export function useFieldCommand(identity:string,submit:(value:Record<string,unknown>)=>Promise<unknown>){
 const attempt=useRef<Record<string,unknown>|null>(null),sending=useRef(false);
 const [busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 useBlockedEntry('field-command:'+identity,busy||unknown);
 async function run(value?:Record<string,unknown>){
  if(sending.current)return false;
  if(!attempt.current&&value)attempt.current=value;
  if(!attempt.current)return false;
  sending.current=true;setBusy(true);
  try{
   const r=await submit(attempt.current) as {ok?:boolean;uncertain?:boolean}|undefined;
   if(r?.ok===true){attempt.current=null;setUnknown(false);return true;}
   if(!unknown&&r?.uncertain===false){attempt.current=null;setUnknown(false);return false;}
   setUnknown(true);return false;
  }catch{setUnknown(true);return false;}
  finally{sending.current=false;setBusy(false);}
 }
 return {run,busy,unknown};
}
