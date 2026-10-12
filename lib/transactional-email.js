import {validGuardSignature} from './website-guard.js';
export class MailFailure extends Error{constructor(status,code='MAIL_PROVIDER_UNAVAILABLE'){super(code);this.status=status;}}
export function relayPayload(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!['status','send'].includes(raw.action)||!/^[-a-f0-9]{36}$/i.test(raw.organization||''))throw new MailFailure(400);
 if(raw.action==='status')return raw;
 if(!/^[-a-f0-9]{36}$/i.test(raw.id||'')||typeof raw.to!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.to)||/[\r\n]/.test(raw.to)||typeof raw.subject!=='string'||!raw.subject.trim()||raw.subject.length>998||/[\r\n]/.test(raw.subject)||typeof raw.body!=='string'||raw.body.length>100000||typeof raw.html!=='string'||raw.html.length>250000)throw new MailFailure(400);
 if(raw.replyTo&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.replyTo)||/[\r\n]/.test(raw.replyTo)))throw new MailFailure(400);
 if(raw.attachment&&(!/^[-a-zA-Z0-9_.]+\.pdf$/.test(raw.attachment.filename||'')||typeof raw.attachment.content!=='string'||raw.attachment.content.length>4000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw.attachment.content)||!Buffer.from(raw.attachment.content,'base64').subarray(0,5).equals(Buffer.from('%PDF-'))))throw new MailFailure(400);
 return raw;
}
export async function relayEmail(req,env=process.env,transport=fetch){
 const body=typeof req.body==='string'?req.body:JSON.stringify(req.body),secret=env.CRM_AVAILABILITY_BYPASS_SECRET;
 if(Buffer.byteLength(body)>4200000||!validGuardSignature(secret,body,req.headers['x-ynsg-guard-time'],req.headers['x-ynsg-guard-signature']))throw new MailFailure(401);
 const data=relayPayload(JSON.parse(body));if(data.organization!==env.CRM_ORGANIZATION_ID)throw new MailFailure(403);
 const sender=env.TRANSACTIONAL_EMAIL_FROM||env.REQUEST_FROM_EMAIL;
 if(!env.RESEND_API_KEY)throw new MailFailure(503,'MAIL_API_KEY_REQUIRED');
 if(!sender)throw new MailFailure(503,'MAIL_SENDER_REQUIRED');
 if(/@resend\.dev[>\s]*$/i.test(sender))throw new MailFailure(503,'MAIL_VERIFIED_DOMAIN_REQUIRED');
 if(/[\r\n]/.test(sender))throw new MailFailure(503,'MAIL_SENDER_INVALID');
 if(data.action==='status')return {ready:true,provider:'resend',sender};
 const r=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ynsg-'+data.organization+'-'+data.id},body:JSON.stringify({from:sender,to:[data.to],subject:data.subject,text:data.body,html:data.html,...(data.replyTo?{reply_to:data.replyTo}:{}),...(data.attachment?{attachments:[{filename:data.attachment.filename,content:data.attachment.content}]}:{})}),signal:AbortSignal.timeout(12000)});
 const result=await r.json();if(!r.ok||typeof result.id!=='string')throw new MailFailure(r.status,r.status===403&&/domain.*not verified|verify.{0,30}domain/i.test(String(result.message))?'MAIL_SENDER_DOMAIN_REJECTED':r.status===403&&/testing emails|own email|test.{0,20}recipient/i.test(String(result.message))?'MAIL_TEST_RECIPIENT_RESTRICTED':r.status===401?'MAIL_API_KEY_REJECTED':'MAIL_PROVIDER_UNAVAILABLE');return {accepted:true,id:result.id};
}
