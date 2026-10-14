import {NextResponse,after} from 'next/server';
import {z} from 'zod';
import {authorizeGoogle,serverDatabase} from '../../../lib/google-server';
import {sameOrigin} from '../../../lib/session';
import {recurringInput,recurringContext,recurringDates,recurringErrors,type Series} from '../../../lib/recurring-series';
import {schedulingTravel} from '../../../lib/scheduling-travel';
import {dispatchGoogleMail} from '../../../lib/google-mail';
import {syncGoogleCalendar} from '../../../lib/google-sync';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('check'),input:recurringInput}).strict(),
 z.object({action:z.literal('book'),input:recurringInput,review:z.uuid(),key:z.string().min(16).max(128)}).strict(),
 z.object({action:z.literal('stop'),organization:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),reason:z.string().trim().min(2).max(1000),key:z.string().min(16).max(128)}).strict(),
]);
function failed(e:unknown){const code=e instanceof Error?e.message:'';return json({error:recurringErrors[code]||(code==='UNAUTHORIZED'?'Sign in to manage weekly visits.':code==='FORBIDDEN'?'Owner access is required.':'Weekly visits were not changed. Refresh and review the calendar and travel setup.')},code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:e instanceof z.ZodError?400:409);}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,org=z.uuid().parse(q.get('organization')),{db}=await authorizeGoogle(org);
 if(q.get('first')){const r=await db.rpc('recurring_context',{p_org:org,p_first:z.uuid().parse(q.get('first'))});if(r.error)throw Error(r.error.message);return json({context:recurringContext.parse(r.data)});}
 const requestId=q.get('request');if(requestId)z.uuid().parse(requestId);
 const page=z.coerce.number().int().min(0).max(100000).parse(q.get('page')||0);
 const r=await db.rpc('recurring_workspace',{p_org:org,p_request:requestId||null,p_page:page});if(r.error)throw Error(r.error.message);
 if(!Array.isArray(r.data))throw Error('FAILED');const series=r.data as Series[];
 return json({series:series.slice(0,20),hasMore:series.length>20,page});
}catch(e){return failed(e);}}
async function notify(org:string,db:Awaited<ReturnType<typeof authorizeGoogle>>['db']){after(async()=>{await Promise.allSettled([dispatchGoogleMail(org,db),process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true'?syncGoogleCalendar(org):Promise.resolve()]);});}
export async function POST(request:Request){if(!sameOrigin(request))return json({error:'Request not accepted.'},403);try{
 const body=await request.text();if(Buffer.byteLength(body)>8000)return json({error:'Request too large.'},413);
 const c=schema.parse(JSON.parse(body)),org=c.action==='stop'?c.organization:c.input.organization,{db,user,access}=await authorizeGoogle(org);
 if(c.action==='stop'){const r=await db.rpc('stop_recurring_series',{p_org:org,p_id:c.id,p_revision:c.revision,p_reason:c.reason,p_key:c.key});if(r.error)throw Error(r.error.message);await notify(org,db);return json({result:r.data});}
 if(c.action==='book'){const r=await db.rpc('book_recurring_series',{p_org:org,p_input:c.input,p_review:c.review,p_key:c.key});if(r.error)throw Error(r.error.message);if(!r.data)throw Error('REVIEW_REQUIRED');await notify(org,db);return json({result:r.data});}
 const r=await db.rpc('recurring_context',{p_org:org,p_first:c.input.firstAppointment});if(r.error)throw Error(r.error.message);const ctx=recurringContext.parse(r.data),plan=recurringDates(ctx.first);
 const buffer=z.number().int().min(0).max(180).parse((ctx.settings.scheduling as Record<string,unknown>)?.bufferMinutes);
 const resources=await db.from('resources').select('id,kind').eq('organization_id',org).in('id',ctx.resources);if(resources.error)throw Error('RESOURCE_UNAVAILABLE');
 const operators=resources.data.filter(v=>v.kind==='operator').map(v=>v.id);
 const facts:{start:string;end:string;before:number;after:number;status:string}[]=[];
 // Bound provider work and fail closed on unavailable routing. No browser-supplied busy/travel facts.
 for(let offset=1;offset<plan.visits.length;offset+=4){
  const batch=await Promise.all(plan.visits.slice(offset,offset+4).map(async v=>{const travel=await schedulingTravel(db,org,ctx.first.requestId,ctx.first.id,ctx.resources,operators,Date.parse(v.start),Date.parse(v.end),ctx.first.timezone,buffer);
   if(travel.status!=='verified')throw Error('ROUTE_UNAVAILABLE');
   return {start:v.start,end:v.end,before:Math.max(c.input.travelBeforeMinutes,travel.before),after:Math.max(c.input.travelAfterMinutes,travel.after),status:'verified'};
  }));facts.push(...batch);
 }
 // The locked commit checks every operating day, block, resource, buffered conflict and source revision.
 const begin=new Date(Date.parse(plan.visits[1]!.start)-540*60000).toISOString(),finish=new Date(Date.parse(plan.visits.at(-1)!.end)+540*60000).toISOString();
 const capacity=await db.rpc('recurring_capacity_snapshot',{p_org:org,p_resources:ctx.resources,p_begin:begin,p_finish:finish});if(capacity.error)throw Error(capacity.error.message);
 const interval=z.object({start:z.iso.datetime({offset:true}),end:z.iso.datetime({offset:true})});
 const observations=z.object({reservations:z.array(interval),blocks:z.array(interval)}).parse(capacity.data);
 const intervals=[...observations.reservations,...observations.blocks].map(v=>({start:Date.parse(v.start),end:Date.parse(v.end)}));
 if(intervals.some(v=>!Number.isFinite(v.start)||!Number.isFinite(v.end)||v.end<=v.start))throw Error('REVIEW_REQUIRED');
 const checked=plan.visits.map((v,i)=>({...v,available:i===0||!intervals.some(x=>x.start<Date.parse(v.end)+(buffer+facts[i-1]!.after)*60000&&x.end>Date.parse(v.start)-(buffer+facts[i-1]!.before)*60000)}));
 if(checked.some(v=>!v.available))return json({visits:checked,conflicts:checked.filter(v=>!v.available).length,endExclusive:plan.endExclusive,review:null});
 const session=z.uuid().parse(JSON.parse(Buffer.from(access.split('.')[1]!,'base64url').toString('utf8')).session_id);
 const saved=await serverDatabase().rpc('record_recurring_review',{p_org:org,p_actor:user.id,p_session:session,p_input:c.input,p_context:ctx,p_facts:facts});if(saved.error)throw Error(saved.error.message);
 return json({visits:checked,conflicts:0,endExclusive:plan.endExclusive,review:saved.data,validUntil:new Date(Date.now()+60000).toISOString()});
}catch(e){return failed(e);}}
