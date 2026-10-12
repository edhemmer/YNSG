import {centralReady,sendCentralEmail} from './central-mail';
import {guardDigest} from '../../../lib/website-guard.js';
import {serverDatabase} from './google-server';
import type {BusinessMessage} from './transactional-mail-message.ts';
export type {BusinessMessage} from './transactional-mail-message.ts';
export async function mailTransport(org:string){const r=await serverDatabase().rpc('transactional_mail_status',{p_org:org});if(r.error)throw Error('MAIL_STATUS_UNAVAILABLE');return r.data?.enabled?{...r.data,ready:r.data.provider==='resend'?centralReady(r.data.sender):true} as {enabled:true;ready:boolean;provider:'resend'|'relay';origin:string;sender:string}:null;}
export async function mailRelay(org:string,origin:string,action:'status'|'send',id?:string,message?:BusinessMessage,transport:typeof fetch=fetch){
 const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('MAIL_ORIGIN_REQUIRED');
 const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;if(!secret||secret.length<32)throw Error('MAIL_KEY_REQUIRED');
 const body=JSON.stringify({action,organization:org,...(id?{id}:{}),...(message?{...message,html:message.html||'',attachment:message.attachment?{filename:message.attachment.filename,content:Buffer.from(message.attachment.bytes).toString('base64')}:undefined}:{})}),timestamp=String(Date.now());
 const r=await transport(new URL('/api/transactional-email',u),{method:'POST',headers:{'Content-Type':'application/json','x-ynsg-guard-time':timestamp,'x-ynsg-guard-signature':guardDigest(secret,timestamp+':'+body)},body,redirect:'error',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Object.assign(Error(['MAIL_API_KEY_REQUIRED','MAIL_SENDER_REQUIRED','MAIL_VERIFIED_DOMAIN_REQUIRED','MAIL_SENDER_INVALID','MAIL_SENDER_DOMAIN_REJECTED','MAIL_API_KEY_REJECTED','MAIL_TEST_RECIPIENT_RESTRICTED'].includes(d.code)?d.code:'MAIL_PROVIDER_UNAVAILABLE'),{status:r.status});return d;
}
export async function sendBusinessEmail(org:string,id:string,m:BusinessMessage,transport:typeof fetch=fetch){const service=await mailTransport(org);if(!service||!service.ready)throw Error('MAIL_SERVICE_REQUIRED');if(service.provider==='resend')return sendCentralEmail(org,id,m,transport);const d=await mailRelay(org,service.origin,'send',id,m,transport);if(!d.accepted||typeof d.id!=='string')throw Error('MAIL_PROVIDER_UNAVAILABLE');return d.id as string;}
