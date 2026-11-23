import {marketingEmail,JOURNEYS,type Journey} from './marketing-emails.ts';
import type {BusinessMessage} from './transactional-mail-message.ts';
type Db={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:any;error:unknown}>};
type Send=(org:string,id:string,message:BusinessMessage)=>Promise<string>;
type Transport=(org:string)=>Promise<{ready:boolean;provider:string}|null>;
import {businessIdentity} from '../../../lib/business-identity.js';
// Small hourly batches spread the month's email across many mornings and stay well inside provider limits.
export const MARKETING_BATCH=12;
type Claimed={id:string;journey:string;audience:string;email:string;name:string|null;token:string;stage:string};
export function centralMonth(at=new Date()){return Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'numeric'}).format(at));}
// Dependencies are passed in by the worker route (database, email sender, email service status).
export async function runMarketing(org:string,db:Db,send:Send,transport:Transport){
 const service=await transport(org);
 // Marketing uses the platform email service only; without it nothing is claimed.
 if(!service||!service.ready||service.provider!=='resend')return {planned:0,sent:0,failed:0,paused:'mail_service'};
 const plan=await db.rpc('marketing_automation_plan',{p_org:org});
 if(plan.error)throw Error('PLAN_FAILED');
 if(!plan.data?.enabled)return {planned:0,sent:0,failed:0,paused:'off'};
 const claim=await db.rpc('marketing_automation_claim',{p_org:org,p_limit:MARKETING_BATCH});
 if(claim.error||!Array.isArray(claim.data))throw Error('CLAIM_FAILED');
 let sent=0,failed=0,stop=false;const month=centralMonth();
 // Business contacts (inquiry form or a business account) get the business series. A failed lookup falls back to the home series.
 let business=new Set<string>();
 if((claim.data as Claimed[]).length){try{const seg=await db.rpc('marketing_business_sends',{p_org:org,p_ids:(claim.data as Claimed[]).map(r=>r.id)});if(!seg.error&&Array.isArray(seg.data))business=new Set(seg.data as string[]);}catch{/* home series */}}
 for(const row of claim.data as Claimed[]){
  if(stop){await db.rpc('marketing_automation_finish',{p_org:org,p_id:row.id,p_status:'queued',p_provider:null,p_error:'batch_paused'});continue;}
  if(!JOURNEYS.includes(row.journey as Journey)||!['customer','prospect'].includes(row.audience)){await db.rpc('marketing_automation_finish',{p_org:org,p_id:row.id,p_status:'skipped',p_provider:null,p_error:'unknown_journey'});continue;}
  try{
   const m=marketingEmail({journey:row.journey as Journey,audience:row.audience as 'customer'|'prospect',month,name:row.name,sendId:row.id,token:row.token,stage:row.stage,segment:business.has(row.id)?'business':'home'});
   const id=await send(org,row.id,{to:row.email,subject:m.subject,body:m.body,html:m.html,replyTo:businessIdentity.email,headers:m.headers});
   await db.rpc('marketing_automation_finish',{p_org:org,p_id:row.id,p_status:'sent',p_provider:id,p_error:null});sent++;
  }catch(error){
   const status=(error as {status?:number}).status;
   // Provider quota or rate limits pause the batch and keep the email in line for a later hour.
   const retry=status===429||status===503||status===500||(error as Error).message==='MAIL_PROVIDER_UNAVAILABLE';
   if(retry)stop=true;
   await db.rpc('marketing_automation_finish',{p_org:org,p_id:row.id,p_status:retry?'queued':'failed',p_provider:null,p_error:retry?'provider_busy':'rejected'});
   if(!retry)failed++;
  }
 }
 return {planned:Number(plan.data.queued)||0,sent,failed};
}
