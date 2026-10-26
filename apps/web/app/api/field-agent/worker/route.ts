import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {serverDatabase} from '../../../../lib/google-server';
import {completeInvoicePayments} from '../../../../lib/complete-invoice-payments';
import {prepareAgentPlan} from '../../../../lib/field-agent-plan';
import {suggestFieldPreparation} from '../../../../lib/field-agent-ai';
import {taskResolution} from '../../../../lib/field-agent-resolution';
import type {InboxRequest,LinkedQuote,LinkedJob} from '../../../../lib/request-inbox';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
function validKey(value:string|null,secret:string|undefined){
 if(!secret||secret.length<32||!value)return false;
 const a=Buffer.from(value),b=Buffer.from('Bearer '+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function GET(request:Request){
 if(!validKey(request.headers.get('authorization'),process.env.CRON_SECRET))return NextResponse.json({error:'Access is required.'},{status:401,headers});
 const org=process.env.GOOGLE_WORKER_ORGANIZATION_ID;
 if(!org||!/^[0-9a-f-]{36}$/i.test(org))return NextResponse.json({error:'Business automation needs setup.'},{status:503,headers});
 try{
  const db=serverDatabase();
  // Bounded candidate discovery: open requests plus previous proposals, for closure cleanup.
  const total=await db.from('service_requests').select('id',{head:true,count:'exact'}).eq('organization_id',org).not('status','in','(declined,canceled)').is('recurring_series_id',null);
  if(total.error||total.count===null)throw Error('DISCOVERY_FAILED');
  const pages=Math.max(1,Math.ceil(total.count/10));
  const page=Math.floor(Date.now()/86400000)%pages;
  const [open,prior]=await Promise.all([
   db.from('service_requests').select('id').eq('organization_id',org).not('status','in','(declined,canceled)').is('recurring_series_id',null).order('created_at',{ascending:true}).order('id').range(page*10,page*10+9),
   db.from('field_agent_tasks').select('request_id').eq('organization_id',org).eq('status','proposed').order('updated_at',{ascending:true}).limit(10)
  ]);
  if(open.error||prior.error)throw Error('DISCOVERY_FAILED');
  const ids=[...new Set([...(prior.data||[]).map(x=>x.request_id),...(open.data||[]).map(x=>x.id)])].slice(0,20);
  let processed=0,needsAttention=0,aiBudget=1;
  for(const id of ids){
   try{
    const record=await db.from('service_requests').select('id,customer_id,status,revision,created_at,original_submission,appointments!appointments_organization_id_request_id_fkey(id,request_id,job_id,status,revision,start_at,end_at,arrival_at,expires_at,replaces_id,customer_response)').eq('organization_id',org).eq('id',id).maybeSingle();
    if(record.error||!record.data)throw Error('READ_FAILED');
    const quotes=await db.from('quotes').select('id,request_id,status,current_version,quote_versions(version,scope,labor_cents,duration_minutes)').eq('organization_id',org).eq('request_id',id).limit(101);
    if(quotes.error||!quotes.data||quotes.data.length>100)throw Error('READ_FAILED');
    const jobs=quotes.data.length?await db.from('jobs').select('id,quote_id,approved_version,status,revision').eq('organization_id',org).in('quote_id',quotes.data.map(x=>x.id)).limit(101):{data:[],error:null};
    if(jobs.error||!jobs.data||jobs.data.length>100)throw Error('READ_FAILED');
    const invoices=jobs.data.length?await db.from('invoices').select('id,job_id,number,total_cents').eq('organization_id',org).in('job_id',jobs.data.map(x=>x.id)).limit(101):{data:[],error:null};
    if(invoices.error||!invoices.data||invoices.data.length>100)throw Error('READ_FAILED');
    const complete=await completeInvoicePayments(db,org,invoices.data);
    const tasks=prepareAgentPlan(record.data as unknown as InboxRequest,quotes.data as LinkedQuote[],jobs.data as LinkedJob[],complete);
    const revision=record.data.revision;
    const still=await db.from('service_requests').select('revision').eq('organization_id',org).eq('id',id).maybeSingle();
    if(still.error||still.data?.revision!==revision)throw Error('STALE_READ');
    for(const task of tasks){
     let detail=task.detail;
     // Limit external model requests to one new task per scheduled run.
     // Never transmit customer names, addresses, instructions, contact details or payment records.
     if(aiBudget>0&&process.env.YNSG_AI_ENABLED==='true'){
      const existing=await db.from('field_agent_tasks').select('id,detail').eq('organization_id',org).eq('request_id',id).eq('request_revision',revision).eq('task_kind',task.kind).maybeSingle();
      if(existing.error)throw Error('SAVE_FAILED');
      if(existing.data?.detail?.startsWith(task.detail+' Optional AI preparation (review only): ')){
       detail=existing.data.detail;
      }else if(!existing.data||existing.data.detail!==task.detail){
       aiBudget--;
       const advice=await suggestFieldPreparation(task);
       if(advice)detail+=' Optional AI preparation (review only): '+advice;
      }
     }
     const saved=await db.from('field_agent_tasks').upsert({organization_id:org,request_id:id,request_revision:revision,task_kind:task.kind,title:task.title,detail,status:'proposed',updated_at:new Date().toISOString()},{onConflict:'organization_id,request_id,request_revision,task_kind'});
     if(saved.error)throw Error('SAVE_FAILED');
    }
    // Retire only proposals not supported by the latest authoritative decision.
    const previous=await db.from('field_agent_tasks').select('id,request_revision,task_kind').eq('organization_id',org).eq('request_id',id).eq('status','proposed').limit(100);
    if(previous.error||!previous.data||previous.data.length===100)throw Error('SAVE_FAILED');
    for(const task of previous.data){
     if(task.request_revision===revision&&tasks.some(t=>t.kind===task.task_kind))continue;
     const now=new Date().toISOString();
     const done=await db.from('field_agent_tasks').update({status:'superseded',resolution:taskResolution(task.task_kind,tasks[0]?.kind||null,record.data.status),resolved_at:now,updated_at:now}).eq('organization_id',org).eq('id',task.id).eq('status','proposed');
     if(done.error)throw Error('SAVE_FAILED');
    }
    processed++;
   }catch{needsAttention++;}
  }
  return NextResponse.json({processed,needsAttention,automaticActions:0},{status:needsAttention?503:200,headers});
 }catch{return NextResponse.json({error:'Field preparation unavailable.'},{status:503,headers});}
}
