import {createClient} from '@supabase/supabase-js';

export const EMAIL_VERIFIER_COOKIE='ynsg-email-pkce';
export const EMAIL_STORAGE_KEY='ynsg-email';
// Only the latest verifier crosses requests. Sessions stay in saveSession's
// httpOnly cookies. A newer email replaces the previous browser-bound flow.
export function emailVerifierStorage(initial:string|null){
 let value=initial;
 const key=EMAIL_STORAGE_KEY+'-code-verifier';
 return {
  storage:{
   getItem:(name:string)=>name===key?value:null,
   setItem:(name:string,next:string)=>{if(name===key)value=next;},
   removeItem:(name:string)=>{if(name===key)value=null;},
  },
  current:()=>value,
 };
}
export function createEmailClient(url:string,key:string,verifier:string|null,fetcher?:typeof fetch){
 const state=emailVerifierStorage(verifier);
 const client=createClient(url,key,{
  auth:{flowType:'pkce',storageKey:EMAIL_STORAGE_KEY,storage:state.storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},
  ...(fetcher?{global:{fetch:fetcher}}:{}),
 });
 return {client,currentVerifier:state.current};
}
