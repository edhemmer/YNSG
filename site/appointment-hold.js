export function selectionKey(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const value=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
 return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}
export async function appointmentHold(input,transport=fetch,timeoutMs=15000){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await transport('/api/appointment-hold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal,keepalive:input.action==='release'});
  const result=await response.json();
  if(!response.ok||result?.ok!==true){const error=new Error(typeof result?.error==='string'?result.error:'We couldn’t hold that time. Please try again, or send your request without a time.');error.status=response.status;throw error;}
  if(input.action==='release')return {ok:true};
  if(!/^[a-f0-9]{64}$/.test(result.token||'')||Date.parse(result.start)!==Date.parse(input.start)||!Number.isFinite(Date.parse(result.expiresAt))||Date.parse(result.expiresAt)<=Date.now()||Date.parse(result.end)-Date.parse(result.start)!==7200000)throw Error('We couldn’t hold that time. Please try again, or send your request without a time.');
  return {...result,start:new Date(result.start).toISOString(),end:new Date(result.end).toISOString(),expiresAt:new Date(result.expiresAt).toISOString()};
 }finally{clearTimeout(timeout);}
}
