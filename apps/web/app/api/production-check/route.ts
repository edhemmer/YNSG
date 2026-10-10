import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sameOrigin,failure} from '../../../lib/session';
import {authorizeGoogle,serverDatabase,accessToken} from '../../../lib/google-server';
import {emailRaw,sendEmail,GoogleFailure} from '../../../lib/google-core';
import {productionSamples,type SampleSuite} from '../../../lib/production-samples';
import {invoicePdf} from '../../../lib/invoice-pdf';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
async function context(org:string){
 const session=await authorizeGoogle(org);
 const cfg=await session.db.from('configuration_versions').select('settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).single();
 if(cfg.error)throw cfg.error;
 const recipient=String(cfg.data.settings.notificationRecipient||'').toLowerCase();
 if(!session.user.email||session.user.email.toLowerCase()!==recipient)throw Error('OWNER_RECIPIENT_REQUIRED');
 return {...session,settings:cfg.data.settings,recipient,server:serverDatabase()};
}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,org=z.uuid().parse(q.get('organization'));
 const c=await context(org);
 let record;
 if(q.has('run'))record=await c.server.from('outbox').select('id,payload').eq('organization_id',org).eq('id',z.uuid().parse(q.get('run'))).eq('kind','diagnostic.sample_suite').maybeSingle();
 else record=await c.server.from('outbox').select('id,payload').eq('organization_id',org).eq('kind','diagnostic.sample_suite').order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(record.error)throw record.error;
 if(!record.data)return json({run:null,recipient:c.recipient});
 const suite=record.data.payload.suite as SampleSuite;
 if(q.get('format')==='pdf'){const bytes=await invoicePdf(suite.invoice);return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="sample-invoice-not-a-bill.pdf"'}});}
 const results=await c.server.from('outbox').select('event_key,status,payload').eq('organization_id',org).eq('object_id',record.data.id).eq('kind','diagnostic.template_preview');
 if(results.error)throw results.error;
 return json({run:record.data.id,recipient:c.recipient,suite,results:results.data.map(r=>({template:r.payload.template,status:r.status}))});
}catch(e){return failure(e)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Request not accepted.'},403);
 try{
 const raw=await request.text();if(Buffer.byteLength(raw)>2048)return json({error:'Request too large.'},413);
 const v=z.discriminatedUnion('action',[z.object({action:z.literal('create'),organization:z.uuid(),key:z.uuid()}).strict(),z.object({action:z.literal('send'),organization:z.uuid(),run:z.uuid(),template:z.string().min(1).max(80),reviewed:z.literal(true)}).strict()]).parse(JSON.parse(raw));
 const c=await context(v.organization);
 if(v.action==='create'){
 const existing=await c.server.from('outbox').select('id').eq('organization_id',v.organization).eq('event_key','sample-suite:'+v.key).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return json({run:existing.data.id});
 const recent=await c.server.from('outbox').select('id').eq('organization_id',v.organization).eq('kind','diagnostic.sample_suite').gte('created_at',new Date(Date.now()-5*60000).toISOString()).limit(1);if(recent.error)throw recent.error;if(recent.data.length)return json({error:'A recent sample set is available. Open it instead of creating another.'},429);
 const run=randomUUID(),suite=productionSamples(c.settings,v.organization,c.recipient,process.env.APP_ORIGIN!,run);
 const saved=await c.server.from('outbox').insert({organization_id:v.organization,id:run,event_key:'sample-suite:'+v.key,kind:'diagnostic.sample_suite',object_id:run,payload:{actor:c.user.id,suite},status:'suppressed'});if(saved.error)throw saved.error;
 return json({run});
 }
 const record=await c.server.from('outbox').select('payload').eq('organization_id',v.organization).eq('id',v.run).eq('kind','diagnostic.sample_suite').single();if(record.error)throw record.error;
 const suite=record.data.payload.suite as SampleSuite,message=suite.messages.find(m=>m.id===v.template);
 if(!message||message.to.toLowerCase()!==c.recipient)return json({error:'This sample does not match the approved owner address.'},409);
 const permission=await c.db.rpc('mail_delivery_status',{p_org:v.organization});if(permission.error||!permission.data?.enabled||process.env.GOOGLE_GMAIL_DELIVERY_ENABLED!=='true')return json({error:'Email sending is paused. Check your Google connection in Settings.'},409);
 const {token,account}=await accessToken(v.organization);if(account.gmail_test!=='accepted'||account.email?.toLowerCase()!==c.settings.sender?.toLowerCase())return json({error:'Verify your Gmail sender in Settings before sending samples.'},409);
 const bytes=message.pdf?await invoicePdf(suite.invoice):null;
 const rawEmail=emailRaw(account.email!,c.recipient,message.subject,message.body,'ynsg-sample-'+v.run+'-'+v.template,{fromName:c.settings.displayName,html:message.html,...(bytes?{attachment:{filename:'sample-invoice-not-a-bill.pdf',bytes}}:{})});
 const eventKey='sample:'+v.run+':'+v.template;
 const before=await c.server.from('outbox').select('id,status').eq('organization_id',v.organization).eq('event_key',eventKey).maybeSingle();if(before.error)throw before.error;if(before.data)return json({status:before.data.status,replay:true});
 const id=randomUUID();
 const started=await c.server.from('outbox').insert({organization_id:v.organization,id,event_key:eventKey,kind:'diagnostic.template_preview',object_id:v.run,payload:{actor:c.user.id,template:v.template,recipient:c.recipient,subject:message.subject},status:'sending',attempts:1,lease_until:new Date(Date.now()+120000).toISOString()});
 if(started.error){if(started.error.code==='23505')return json({status:'sending',replay:true});throw started.error;}
 let status='needs_reconciliation',providerId:string|null=null;
 try{providerId=await sendEmail(token,rawEmail);status='accepted';}catch(e){if(e instanceof GoogleFailure&&e.status>=400&&e.status<500)status='failed';}
 const finished=await c.server.from('outbox').update({status,lease_until:null,payload:{actor:c.user.id,template:v.template,recipient:c.recipient,subject:message.subject,providerId}}).eq('organization_id',v.organization).eq('id',id).eq('status','sending').select('id');
 return json({status:finished.error||finished.data?.length!==1?'needs_reconciliation':status});
 }catch(e){return failure(e)}
}
