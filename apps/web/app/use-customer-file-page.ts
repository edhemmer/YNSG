'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {verifyFilePage,type FilePageCursor} from '../lib/customer-file-page-contract';
import type {z} from 'zod';
import type {filePage} from '../lib/customer-file-page-contract';
type Page=z.infer<typeof filePage>;
type Position={cursor:FilePageCursor|null;index:number;previous:(FilePageCursor|null)[]};
const first=():Position=>({cursor:null,index:0,previous:[]});
export function useCustomerFilePage(organization:string,customer:string,filters:{job?:string;invoice?:string}={},autoLoad=false){
 const [page,setPage]=useState<Page|null>(null),[loading,setLoading]=useState(autoLoad),[readFailed,setReadFailed]=useState(false),[error,setError]=useState(''),[index,setIndex]=useState(0);
 const position=useRef(first()),attempt=useRef(first()),active=useRef(false),sequence=useRef(0),mounted=useRef(true);
 async function load(target:Position){
  if(active.current)return false;active.current=true;attempt.current=target;const seq=++sequence.current;setLoading(true);setError('');
  const input={organization,customer,...filters,...(target.cursor?{afterCreatedAt:target.cursor.createdAt,afterId:target.cursor.id}:{})};
  try{const response=await sessionFetch('/api/customer-file-page?'+new URLSearchParams(input),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!response.ok){if((response.status===401||response.status===403)&&mounted.current&&seq===sequence.current)setPage(null);throw Error();}
   const checked=verifyFilePage(input,await response.json());if(!mounted.current||seq!==sequence.current)return false;
   position.current=target;setPage(checked);setIndex(target.index);setReadFailed(false);return true;
  }catch{if(mounted.current&&seq===sequence.current){setReadFailed(true);setError('Attachments could not be verified. Retry this page before adding or sharing files.');}return false;}
  finally{if(mounted.current&&seq===sequence.current){active.current=false;setLoading(false);}}
 }
 useEffect(()=>{mounted.current=true;if(autoLoad)void load(first());return()=>{mounted.current=false;active.current=false;sequence.current++;};},[]);
 return {page,index,loading,readFailed,error,
  refresh:()=>load(position.current),retry:()=>load(readFailed?attempt.current:position.current),reset:()=>load(first()),
  next:()=>{if(!page?.nextCursor||readFailed)return Promise.resolve(false);const p=position.current;return load({cursor:page.nextCursor,index:p.index+1,previous:[...p.previous,p.cursor]});},
  previous:()=>{const p=position.current;if(!p.index||readFailed)return Promise.resolve(false);return load({cursor:p.previous.at(-1)??null,index:p.index-1,previous:p.previous.slice(0,-1)});},
 };
}
