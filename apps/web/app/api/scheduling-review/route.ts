import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sameOrigin } from '../../../lib/session';
import { authorizeGoogle, accessToken, serverDatabase } from '../../../lib/google-server';
import { GoogleFailure, hash } from '../../../lib/google-core';
import { reviewedBusy, type OwnEvent } from '../../../lib/google-availability';
import { schedulingReview } from '../../../../../packages/contracts/scheduling-review';
import { localInstant } from '../../../../../packages/domain/timezone';
import { DomainError } from '../../../../../packages/contracts';
import {schedulingTravel} from '../../../lib/scheduling-travel';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function json(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
import {schedulingMessages as messages} from '../../../lib/scheduling-errors';
import {syncGoogleCalendar} from '../../../lib/google-sync';
import {dispatchGoogleMail} from '../../../lib/google-mail';
async function completed(db:Awaited<ReturnType<typeof authorizeGoogle>>['db'],org:string,result:{id:string;status:string},replay=false){
 if(result.status==='reserved'){
  // Durable outbox/cron remains the retry authority if either provider is down.
  await Promise.allSettled([
   process.env.GOOGLE_CALENDAR_WORKER_ENABLED==='true'?syncGoogleCalendar(org):Promise.resolve(),
   process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'?dispatchGoogleMail(org,db):Promise.resolve()
  ]);
  let delivery=null;
  try{const status=await db.rpc('appointment_delivery_status',{p_org:org,p_appointment:result.id});if(!status.error)delivery=status.data;}catch{/* Booking is committed; delivery remains independently retryable. */}
  return json({ok:true,result,replay,delivery});
 }
 return json({ok:true,result,replay});
}
async function context(db:Awaited<ReturnType<typeof authorizeGoogle>>['db'],org:string,request:string,appointment:string|null){
 const r=await db.rpc('scheduling_review_context',{p_org:org,p_request:request,p_appointment:appointment});
 if(r.error)throw new Error(r.error.message);return r.data;
}
function failed(e:unknown){
 if(e instanceof GoogleFailure)return json({error:e.code==='GOOGLE_EVENT_CHANGED'?'The Google event changed. Resolve its sync issue before approval.':'A current authorized Google calendar check is required.'},e.code==='OWNER_ACCESS_REQUIRED'?403:409);
 if(e instanceof DomainError)return json({error:e.message},409);
 if(e instanceof z.ZodError)return json({error:'Complete the scheduling review and choose valid resources and times.'},400);
 const code=e instanceof Error?e.message:'FAILED';
 return json({error:messages[code]||(code==='UNAUTHORIZED'?'Sign in to continue.':'The appointment was not changed. Refresh and review your access.')},code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:409);
}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,org=z.uuid().parse(q.get('organization')),id=z.uuid().parse(q.get('request'));
 const appointment=q.get('appointment');if(appointment)z.uuid().parse(appointment);
 const {db}=await authorizeGoogle(org);return json(await context(db,org,id,appointment));
}catch(e){return failed(e);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Request not accepted.'},403);
 try{
  const text=await request.text();if(Buffer.byteLength(text)>16000)return json({error:'Request too large.'},413);
  const input=schedulingReview.parse(JSON.parse(text));const {db,user,access}=await authorizeGoogle(input.organizationId);
  const key=hash('reviewed-schedule:'+input.key);
  const commit=input.confirmImmediately&&!input.appointmentId?'commit_confirmed_schedule':'commit_reviewed_schedule';
  const prior=await db.rpc(commit,{p_org:input.organizationId,p_input:input,p_key:key,p_evidence:null});
  if(prior.error)throw new Error(prior.error.message);if(prior.data)return completed(db,input.organizationId,prior.data,true);
  const ctx=await context(db,input.organizationId,input.requestId,input.appointmentId);
  const start=localInstant(input.localStart,ctx.settings.timezone),end=start+input.durationMinutes*60000;
  const {token,account}=await accessToken(input.organizationId);if(!account.calendar_id)throw new GoogleFailure('CALENDAR_REQUIRED');
  let own:OwnEvent|null=null;
  if(ctx.projection?.eventId){
   if(ctx.projection.calendarId!==account.calendar_id||ctx.projection.state!=='synced'||ctx.projection.revision!==ctx.appointment.revision)throw new GoogleFailure('GOOGLE_EVENT_CHANGED');
   own={id:ctx.projection.eventId,etag:ctx.projection.etag,organization:input.organizationId,appointment:input.appointmentId!,revision:ctx.appointment.revision,start:ctx.appointment.start_at,end:ctx.appointment.end_at};
  }
  const buffer=ctx.settings.scheduling.bufferMinutes;if(buffer===null)throw new Error('SETUP_REQUIRED');
  const travel=input.arrivalOffsetMinutes?{before:0,after:0,status:'pickup_review'}:await schedulingTravel(db,input.organizationId,input.requestId,input.appointmentId,input.resources,ctx.resources.filter((r:{kind:string})=>r.kind==='operator').map((r:{id:string})=>r.id),start,end,ctx.settings.timezone,buffer);
  const effective={...input,travelBeforeMinutes:Math.max(input.travelBeforeMinutes,travel.before),travelAfterMinutes:Math.max(input.travelAfterMinutes,travel.after)};
  const busy=await reviewedBusy(token,account.calendar_id,new Date(start-(buffer+effective.travelBeforeMinutes)*60000).toISOString(),new Date(end+(buffer+effective.travelAfterMinutes)*60000).toISOString(),ctx.settings.timezone,own);
  // getUser + owner-access RPC have validated this JWT before extracting its session identifier.
  const claims=JSON.parse(Buffer.from(access.split('.')[1]!,'base64url').toString('utf8'));
  const session=z.uuid().parse(claims.session_id);
  const normalized={...effective,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),arrivalAt:new Date(start+input.arrivalOffsetMinutes*60000).toISOString(),commandInput:input};
  const review=await serverDatabase().rpc('record_scheduling_review',{p_org:input.organizationId,p_actor:user.id,p_session:session,p_key:hash(input.key+':facts:'+busy.checkedAt),p_input:normalized,p_provider:{...busy,travel,connectionRevision:account.revision,windowStart:new Date(start-(buffer+effective.travelBeforeMinutes)*60000).toISOString(),windowEnd:new Date(end+(buffer+effective.travelAfterMinutes)*60000).toISOString()}});
  if(review.error)throw new Error(review.error.message);
  const result=await db.rpc(commit,{p_org:input.organizationId,p_input:input,p_key:key,p_evidence:review.data.evidenceId});
  if(result.error)throw new Error(result.error.message);return completed(db,input.organizationId,result.data);
 }catch(e){return failed(e);}
}
