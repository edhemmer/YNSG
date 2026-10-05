import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
export class WebsiteGuardFailure extends Error {constructor(status){super(status===429?'Please wait a few minutes before trying again, or call 770-630-2094.':'We couldn’t check your request right now. Please try again, or call 770-630-2094.');this.status=status;}}
export const guardDigest=(secret,value)=>createHmac('sha256',secret).update('ynsg-website-guard-v1:'+value).digest('hex');
export function validGuardSignature(secret,body,timestamp,signature,clock=Date.now()){
 if(typeof secret!=='string'||secret.length<32||!/^\d{13}$/.test(timestamp||'')||Math.abs(clock-Number(timestamp))>60000||!/^[a-f0-9]{64}$/.test(signature||''))return false;
 return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(guardDigest(secret,timestamp+':'+body),'hex'));
}
export async function websiteGuard(req,operation,{key,email}={},env=process.env,transport=fetch){
 let url;try{url=new URL(env.CRM_AVAILABILITY_URL);}catch{throw new WebsiteGuardFailure(503);}
 const secret=env.CRM_AVAILABILITY_BYPASS_SECRET;
 if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.pathname!=='/api/public-availability'||url.username||url.password||url.search||url.hash||!secret||secret.length<32||secret.length>512||/\s/.test(secret)||!['availability','request'].includes(operation))throw new WebsiteGuardFailure(503);
 const address=env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
 if(typeof address!=='string'||!isIP(address.trim()))throw new WebsiteGuardFailure(503);
 const body=JSON.stringify({operation,clientHash:guardDigest(secret,'ip:'+address.trim()),keyHash:guardDigest(secret,'key:'+(key||randomUUID())),emailHash:email?guardDigest(secret,'email:'+email.trim().toLowerCase()):null});
 const timestamp=String(Date.now());url.pathname='/api/website-guard';
 try{
  const response=await transport(url,{method:'POST',headers:{'Content-Type':'application/json','x-vercel-protection-bypass':secret,'x-ynsg-guard-time':timestamp,'x-ynsg-guard-signature':guardDigest(secret,timestamp+':'+body)},body,redirect:'error',signal:AbortSignal.timeout(10000)});
  const value=await response.json();if(!response.ok||value.allowed!==true)throw new WebsiteGuardFailure(response.status===429?429:503);
 }catch(error){if(error instanceof WebsiteGuardFailure)throw error;throw new WebsiteGuardFailure(503);}
}

export async function websiteRequest(req,data,key,env=process.env,transport=fetch){
 const url=new URL(env.CRM_AVAILABILITY_URL),secret=env.CRM_AVAILABILITY_BYPASS_SECRET;
 if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.pathname!=='/api/public-availability'||url.username||url.password||url.search||url.hash||!secret||secret.length<32)throw new WebsiteGuardFailure(503);
 const address=env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
 if(typeof address!=='string'||!isIP(address.trim()))throw new WebsiteGuardFailure(503);
 const body=JSON.stringify({key,clientHash:guardDigest(secret,'ip:'+address.trim()),keyHash:guardDigest(secret,'key:'+key),emailHash:guardDigest(secret,'email:'+data.email.trim().toLowerCase()),data});
 const timestamp=String(Date.now());url.pathname='/api/website-request';
 try{
  const response=await transport(url,{method:'POST',headers:{'Content-Type':'application/json','x-vercel-protection-bypass':secret,'x-ynsg-guard-time':timestamp,'x-ynsg-guard-signature':guardDigest(secret,timestamp+':'+body)},body,redirect:'error',signal:AbortSignal.timeout(10000)});
  const value=await response.json();
  if(!response.ok||value.ok!==true||!/^[-a-f0-9]{36}$/i.test(value.id||''))throw new WebsiteGuardFailure(response.status===429?429:503);
  return {ok:true,id:value.id,notification:'pending',saved:true};
 }catch(error){if(error instanceof WebsiteGuardFailure)throw error;throw new WebsiteGuardFailure(503);}
}
