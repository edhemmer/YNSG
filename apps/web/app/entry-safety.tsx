'use client';
import {createContext,useCallback,useContext,useEffect,useRef,type ReactNode} from 'react';
const EntryContext=createContext<{setDraft:(id:string,dirty:boolean)=>void;setBlock:(id:string,blocked:boolean)=>void;canLeave:()=>boolean}>({setDraft:()=>{},setBlock:()=>{},canLeave:()=>true});
export function EntrySafety({children}:{children:ReactNode}){
 const drafts=useRef(new Set<string>());
 const blocks=useRef(new Set<string>());
 const setDraft=useCallback((id:string,dirty:boolean)=>{if(dirty)drafts.current.add(id);else drafts.current.delete(id);},[]);
 const setBlock=useCallback((id:string,blocked:boolean)=>{if(blocked)blocks.current.add(id);else blocks.current.delete(id);},[]);
 const canLeave=useCallback(()=>!blocks.current.size&&(!drafts.current.size||window.confirm('You have unsaved entries. Stay here to save them, or choose OK to leave and discard those changes.')),[]);
 useEffect(()=>{const leave=(event:BeforeUnloadEvent)=>{if(drafts.current.size||blocks.current.size){event.preventDefault();event.returnValue='';}};
  const link=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const url=new URL(anchor.href);if(url.origin===window.location.origin&&(url.pathname!==window.location.pathname||url.search!==window.location.search)&&!canLeave()){event.preventDefault();event.stopPropagation();}};
  window.addEventListener('beforeunload',leave);document.addEventListener('click',link,true);return()=>{window.removeEventListener('beforeunload',leave);document.removeEventListener('click',link,true);};
 },[canLeave]);
 return <EntryContext.Provider value={{setDraft,setBlock,canLeave}}>{children}</EntryContext.Provider>;
}
export const useEntrySafety=()=>useContext(EntryContext);
export function useUnsavedEntry(id:string,dirty:boolean){const {setDraft}=useEntrySafety();useEffect(()=>{setDraft(id,dirty);return()=>setDraft(id,false);},[id,dirty,setDraft]);}
export function useBlockedEntry(id:string,blocked:boolean){const {setBlock}=useEntrySafety();useEffect(()=>{setBlock(id,blocked);return()=>setBlock(id,false);},[id,blocked,setBlock]);}
