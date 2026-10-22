'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {verifyFilePage,type FilePageCursor} from '../lib/customer-file-page-contract';
import type {z} from 'zod';
import type {filePage} from '../lib/customer-file-page-contract';
type Page=z.infer<typeof filePage>;
type Position={cursor:FilePageCursor|null;index:number;previous:(FilePageCursor|null)[]};
const first=():Position=>({cursor:null,index:0,previous:[]});
export function useCustomerFilePage(organization:string,customer:string,filters:{jobs?:string;invoices?:string}={},autoLoad=false){
 const {jobs,invoices}=filters;
 const scope=JSON.stringify([organization,customer,jobs??null,invoices??null]);
 const [storedPage,setStoredPage]=useState<{scope:string;value:Page}|null>(null),[loading,setLoading]=useState(autoLoad),[readFailed,setReadFailed]=useState(false),[error,setError]=useState(''),[index,setIndex]=useState(0);
 const position=useRef(first()),attempt=useRef(first()),active=useRef(false),sequence=useRef(0),mounted=useRef(true);
 const positionScope=useRef(scope),attemptScope=useRef(scope);
 const load=useCallback(async (target:Position)=>{
  if(active.current)return false;active.current=true;attempt.current=target;attemptScope.current=scope;const seq=++sequence.current;setLoading(true);setError('');
  const input={organization,customer,...(jobs===undefined?{}:{jobs}),...(invoices===undefined?{}:{invoices}),...(target.cursor?{afterCreatedAt:target.cursor.createdAt,afterId:target.cursor.id}:{})};
  try{const response=await sessionFetch('/api/customer-file-page?'+new URLSearchParams(input),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!response.ok){if((response.status===401||response.status===403)&&mounted.current&&seq===sequence.current)setStoredPage(null);throw Error();}
   const checked=verifyFilePage(input,await response.json());if(!mounted.current||seq!==sequence.current)return false;
   position.current=target;positionScope.current=scope;setStoredPage({scope,value:checked});setIndex(target.index);setReadFailed(false);return true;
  }catch{if(mounted.current&&seq===sequence.current){setReadFailed(true);setError('Attachments could not be verified. Retry this page before adding or sharing files.');}return false;}
  finally{if(mounted.current&&seq===sequence.current){active.current=false;setLoading(false);}}
 },[organization,customer,jobs,invoices,scope]);
 useEffect(()=>{
 // Capture ref containers so teardown invalidates the latest in-flight generation.
 const teardownMounted=mounted;const teardownActive=active;const teardownSequence=sequence;
 mounted.current=true;setStoredPage(null);setIndex(0);setReadFailed(false);setLoading(autoLoad);setError('');position.current=first();attempt.current=first();positionScope.current=scope;attemptScope.current=scope;if(autoLoad)void load(first());return()=>{teardownMounted.current=false;teardownActive.current=false;teardownSequence.current++;};},[load,autoLoad,scope]);
 // Hide metadata synchronously, before the scope-change effect has reset state.
 const visiblePage=storedPage?.scope===scope?storedPage.value:null;
 const currentPosition=()=>positionScope.current===scope?position.current:first();
 return {page:visiblePage,index:visiblePage?index:0,loading,readFailed,error,
  refresh:()=>load(currentPosition()),retry:()=>load(readFailed&&attemptScope.current===scope?attempt.current:currentPosition()),reset:()=>load(first()),
  next:()=>{if(!visiblePage?.nextCursor||readFailed||positionScope.current!==scope)return Promise.resolve(false);const p=position.current;return load({cursor:visiblePage.nextCursor,index:p.index+1,previous:[...p.previous,p.cursor]});},
  previous:()=>{const p=currentPosition();if(!visiblePage||!p.index||readFailed)return Promise.resolve(false);return load({cursor:p.previous.at(-1)??null,index:p.index-1,previous:p.previous.slice(0,-1)});},
 };
}
