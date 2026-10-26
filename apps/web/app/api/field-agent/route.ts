import {NextResponse} from 'next/server';
import {authenticated,failure} from '../../../lib/session';
import {serverDatabase} from '../../../lib/google-server';
import {GET as prepare} from '../field-intelligence/route';
import {z} from 'zod';
import {taskResolution} from '../../../lib/field-agent-resolution';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const input=z.object({organization:z.uuid(),request:z.uuid()});
/** Refresh persisted owner-review proposals from an authorized, current read.
 * This never executes a prepared task or sends a communication. */
export async function POST(request:Request){
 try{
  const args=input.parse(await request.json());
  const {db,user}=await authenticated();
  const member=await db.from('memberships').select('role').eq('organization_id',args.organization).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(member.error)throw Error('FAILED');
  if(!member.data)return NextResponse.json({error:'Owner access is required.'},{status:403,headers});
  const url=new URL('/api/field-intelligence','https://ynsg.invalid');
  url.searchParams.set('organization',args.organization);url.searchParams.set('request',args.request);
  const response=await prepare(new Request(url));
  if(!response.ok)return NextResponse.json(await response.json(),{status:response.status,headers});
  const prepared=await response.json() as {requestRevision:number;tasks:{kind:string;title:string;detail:string}[]};
  const storage=serverDatabase();
  const current=await storage.from('service_requests').select('revision').eq('organization_id',args.organization).eq('id',args.request).maybeSingle();
  if(current.error||!current.data||current.data.revision!==prepared.requestRevision)throw Error('STALE_INTELLIGENCE');
  const statusRead=await storage.from('service_requests').select('status,revision').eq('organization_id',args.organization).eq('id',args.request).maybeSingle();
  if(statusRead.error||!statusRead.data||statusRead.data.revision!==prepared.requestRevision)throw Error('STALE_INTELLIGENCE');
  const recordStatus=statusRead.data.status;
  for(const task of prepared.tasks){
   const write=await storage.from('field_agent_tasks').upsert({organization_id:args.organization,request_id:args.request,request_revision:prepared.requestRevision,task_kind:task.kind,title:task.title,detail:task.detail,status:'proposed',updated_at:new Date().toISOString()},{onConflict:'organization_id,request_id,request_revision,task_kind'});
   if(write.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  }
  const previous=await storage.from('field_agent_tasks').select('id,request_revision,task_kind').eq('organization_id',args.organization).eq('request_id',args.request).eq('status','proposed').limit(100);
  if(previous.error||!previous.data||previous.data.length===100)throw Error('AGENT_QUEUE_UNAVAILABLE');
  for(const task of previous.data){
   if(task.request_revision===prepared.requestRevision&&prepared.tasks.some(t=>t.kind===task.task_kind))continue;
   const now=new Date().toISOString();
   const done=await storage.from('field_agent_tasks').update({status:'superseded',resolution:taskResolution(task.task_kind,prepared.tasks[0]?.kind||null,recordStatus),resolved_at:now,updated_at:now}).eq('organization_id',args.organization).eq('id',task.id).eq('status','proposed');
   if(done.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  }
  const same=await storage.from('field_agent_tasks').select('id,task_kind,title,detail,status,request_revision').eq('organization_id',args.organization).eq('request_id',args.request).eq('request_revision',prepared.requestRevision).eq('status','proposed').order('created_at');
  if(same.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  return NextResponse.json({requestId:args.request,revision:prepared.requestRevision,tasks:same.data,execution:'owner_review_only'},{headers});
 }catch(e){return failure(e);}
}

/** Existing Today screen reads approval attention; no new workflow surface. */
export async function GET(request:Request){
 try{
  const q=input.pick({organization:true}).parse(Object.fromEntries(new URL(request.url).searchParams));
  const {db,user}=await authenticated();
  const member=await db.from('memberships').select('role').eq('organization_id',q.organization).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(member.error)throw Error('FAILED');
  if(!member.data)return NextResponse.json({error:'Owner access is required.'},{status:403,headers});
  const storage=serverDatabase();
  const found=await storage.from('field_agent_tasks').select('id,request_id,request_revision,task_kind,title,detail,updated_at').eq('organization_id',q.organization).eq('status','proposed').order('updated_at',{ascending:false}).limit(20);
  if(found.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  const ids=[...new Set((found.data||[]).map(x=>x.request_id))];
  const current=ids.length?await storage.from('service_requests').select('id,revision,status').eq('organization_id',q.organization).in('id',ids):{data:[],error:null};
  if(current.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  const valid=(found.data||[]).filter(x=>current.data?.some(r=>r.id===x.request_id&&r.revision===x.request_revision&&!['declined','canceled'].includes(r.status)));
  return NextResponse.json({tasks:valid.slice(0,5),hasMore:valid.length>5,checkedAt:new Date().toISOString()},{headers});
 }catch(e){return failure(e);}
}
