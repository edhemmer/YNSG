import type {SupabaseClient} from '@supabase/supabase-js';
import {emailRaw,sendEmail,GoogleFailure} from './google-core.ts';
import {invoicePdf} from './invoice-pdf.ts';
import type {SampleSuite} from './production-samples.ts';
// Called only within the existing verified, enabled and leased company worker.
export async function dispatchSampleMail(org:string,db:SupabaseClient,token:string,sender:string,settings:Record<string,any>,limit=3,transport:typeof fetch=fetch){
 const pending=await db.from('outbox').select('id,object_id,payload').eq('organization_id',org).eq('kind','diagnostic.template_preview').eq('status','pending').order('created_at').limit(limit);
 if(pending.error)throw Error('SAMPLE_QUEUE_UNAVAILABLE');
 const results=[];
 for(const item of pending.data||[]){
 const suiteRecord=await db.from('outbox').select('payload').eq('organization_id',org).eq('id',item.object_id).eq('kind','diagnostic.sample_suite').single();
 const member=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',item.payload.actor).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
 const suite=suiteRecord.data?.payload.suite as SampleSuite|undefined, message=suite?.messages.find(m=>m.id===item.payload.template);
 const recipient=String(settings.notificationRecipient||'').toLowerCase();
 if(suiteRecord.error||member.error||!member.data||suiteRecord.data?.payload.actor!==item.payload.actor||!message||message.to.toLowerCase()!==recipient||String(item.payload.recipient).toLowerCase()!==recipient||!message.subject.startsWith('[SAMPLE ')||suite?.invoice.sample!==true){
 await db.from('outbox').update({status:'suppressed'}).eq('organization_id',org).eq('id',item.id).eq('status','pending');results.push({id:item.id,status:'suppressed'});continue;
 }
 let raw:string;
 try{const bytes=message.pdf?await invoicePdf(suite.invoice):null;
 raw=emailRaw(sender,recipient,message.subject,message.body,'ynsg-sample-'+item.id,{fromName:settings.displayName,html:message.html,...(bytes?{attachment:{filename:'invoice-1.pdf',bytes}}:{})});}
 catch{await db.from('outbox').update({status:'failed'}).eq('organization_id',org).eq('id',item.id).eq('status','pending');results.push({id:item.id,status:'failed'});continue;}
 const claim=await db.from('outbox').update({status:'sending',attempts:1,lease_until:new Date(Date.now()+120000).toISOString()}).eq('organization_id',org).eq('id',item.id).eq('status','pending').select('id');
 if(claim.error||claim.data?.length!==1)continue;
 let status='needs_reconciliation',providerId:string|null=null;
 try{providerId=await sendEmail(token,raw,transport);status='accepted';}catch(e){if(e instanceof GoogleFailure&&e.status>=400&&e.status<500)status='failed';}
 const finish=await db.from('outbox').update({status,lease_until:null,payload:{...item.payload,providerId}}).eq('organization_id',org).eq('id',item.id).eq('status','sending').select('id');
 results.push({id:item.id,status:finish.error||finish.data?.length!==1?'needs_reconciliation':status});
 }
 return results;
}
