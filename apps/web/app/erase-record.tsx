'use client';
import {useState} from 'react';
/** Two-step permanent delete. The database refuses anything that has an invoice or payment; this only asks first. */
export default function EraseRecord({label,consequence,disabled,run,onDone}:{label:string;consequence:string;disabled:boolean;run:()=>Promise<{ok?:boolean}|void|undefined>;onDone:()=>void}){
 const [open,setOpen]=useState(false),[working,setWorking]=useState(false);
 async function confirm(){
  if(working||disabled)return;setWorking(true);
  try{const result=await run();if(result&&result.ok===true)onDone();}
  finally{setWorking(false);}
 }
 return <div className="erase-record">
  {!open?<button type="button" className="danger-ghost" disabled={disabled} onClick={()=>setOpen(true)}>{label}</button>
  :<div className="erase-confirm" role="group" aria-label={label}>
   <p><strong>Delete permanently?</strong> {consequence}</p>
   <div className="erase-actions"><button type="button" className="danger" disabled={disabled||working} onClick={()=>void confirm()}>{working?'Deleting…':'Delete permanently'}</button><button type="button" className="secondary" disabled={working} onClick={()=>setOpen(false)}>Keep it</button></div>
  </div>}
 </div>;
}
