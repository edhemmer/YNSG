import {NextResponse} from 'next/server';
import {authenticated,failure} from '../../../lib/session';
import {serverDatabase} from '../../../lib/google-server';
import {GET as prepare} from '../field-intelligence/route';
import {z} from 'zod';
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
  for(const task of prepared.tasks){
   const write=await storage.from('field_agent_tasks').upsert({organization_id:args.organization,request_id:args.request,request_revision:prepared.requestRevision,task_kind:task.kind,title:task.title,detail:task.detail,status:'proposed',updated_at:new Date().toISOString()},{onConflict:'organization_id,request_id,request_revision,task_kind'});
   if(write.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  }
  const old=await storage.from('field_agent_tasks').update({status:'superseded',updated_at:new Date().toISOString()}).eq('organization_id',args.organization).eq('request_id',args.request).eq('status','proposed').not('task_kind','in','('+prepared.tasks.map(task=>task.kind).join(',')+')');
  if(old.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  const obsolete=await storage.from('field_agent_tasks').update({status:'superseded',updated_at:new Date().toISOString()}).eq('organization_id',args.organization).eq('request_id',args.request).eq('status','proposed').neq('request_revision',prepared.requestRevision);
  if(obsolete.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  const same=await storage.from('field_agent_tasks').select('id,task_kind,title,detail,status,request_revision').eq('organization_id',args.organization).eq('request_id',args.request).eq('request_revision',prepared.requestRevision).eq('status','proposed').order('created_at');
  if(same.error)throw Error('AGENT_QUEUE_UNAVAILABLE');
  return NextResponse.json({requestId:args.request,revision:prepared.requestRevision,tasks:same.data,execution:'owner_review_only'},{headers});
 }catch(e){return failure(e);}
}
