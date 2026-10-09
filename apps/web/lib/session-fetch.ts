// Refresh only after authentication rejection, never after an ambiguous action
// response. The original body/idempotency key is reused exactly once.
export function createSessionFetch(fetcher:typeof fetch=fetch,lock?:(run:()=>Promise<Response>)=>Promise<Response>){
 let refreshing:Promise<Response>|null=null;
 let signedOut=false;
 let generation=0;
 async function renew(){
  const check=await fetcher('/api/session',{cache:'no-store'});
  if(check.status!==401)return check;
  return fetcher('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'}),cache:'no-store'});
 }
 return async function sessionFetch(path:string,init:RequestInit={}){
  let action='';
  if(path==='/api/session'&&typeof init.body==='string'){try{action=JSON.parse(init.body).action;}catch{}}
  if(action==='logout'){
   signedOut=true;generation++;
   if(refreshing)await refreshing.catch(()=>{});
   const logout=()=>fetcher(path,{...init,cache:'no-store'});
   return lock?lock(logout):logout();
  }
  const currentGeneration=generation;
  const response=await fetcher(path,{...init,cache:'no-store'});
  if(['verify','password'].includes(action)&&response.ok)signedOut=false;
  if(response.status!==401||(path==='/api/session'&&init.method==='POST'&&action!=='set-password'))return response;
  if(signedOut||currentGeneration!==generation)return response;
  if(!refreshing){
   const pending=lock?lock(renew):renew();
   refreshing=pending;
   void pending.finally(()=>{if(refreshing===pending)refreshing=null;}).catch(()=>{});
  }
  const refreshed=await refreshing;
  if(signedOut||currentGeneration!==generation)return new Response(JSON.stringify({error:'Sign in to continue.'}),{status:401});
  if(!refreshed.ok)return refreshed.clone();
  return fetcher(path,{...init,cache:'no-store'});
 };
}

export const sessionFetch=createSessionFetch((...args)=>fetch(...args),run=>{
 // Serialize refreshes between tabs on supported browsers. Recheck inside
 // the lock so the second tab reuses the first tab's rotated cookies.
 if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request('ynsg-session-refresh',run);
 return run();
});

export class SessionApiError extends Error{
 constructor(message:string,public status:number){super(message);}
}
