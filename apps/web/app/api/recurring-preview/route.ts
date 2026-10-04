import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sameOrigin} from '../../../lib/session';
import {authorizeGoogle,accessToken} from '../../../lib/google-server';
import {busyTimes} from '../../../lib/google-core';
import {localInstant} from '../../../../../packages/domain/timezone';
import {weeklyDates,localDay,addDays} from '../../../../../lib/appointment-window.js';
import {recurringPreview} from '../../../../../packages/domain/recurring-preview';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const schema=z.object({organization:z.uuid(),request:z.uuid(),localStart:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),durationMinutes:z.number().int().min(120).max(1440).multipleOf(30),resources:z.array(z.uuid()).min(1).max(30).refine(v=>new Set(v).size===v.length),travelBeforeMinutes:z.number().int().min(0).max(360),travelAfterMinutes:z.number().int().min(0).max(360)}).strict();
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'Request not accepted.'},403);
 try{
  const body=await request.text();if(Buffer.byteLength(body)>8000)return reply({error:'Request too large.'},413);
  const input=schema.parse(JSON.parse(body)),{db}=await authorizeGoogle(input.organization);
  const context=await db.rpc('scheduling_review_context',{p_org:input.organization,p_request:input.request,p_appointment:null});
  if(context.error||!context.data)throw Error('CONTEXT');
  const ctx=context.data,timezone=ctx.settings.timezone,clock=Date.now(),day=input.localStart.slice(0,10),today=localDay(clock,timezone);
  if(day<today||day>addDays(today,30))return reply({error:'Choose the first visit within the next 30 days.'},400);
  const chosen=ctx.resources.filter((r:{id:string;status:string})=>input.resources.includes(r.id));
  if(chosen.length!==input.resources.length||chosen.some((r:{status:string})=>r.status!=='available')||!chosen.some((r:{kind:string})=>r.kind==='operator'))return reply({error:'Select an available operator and all required equipment.'},409);
  const series=weeklyDates(day),start=localInstant(input.localStart,timezone),last=localInstant(series.dates.at(-1)!+'T'+input.localStart.slice(11),timezone);
  const padding=(360+180)*60000,begin=new Date(start-padding).toISOString(),finish=new Date(last+input.durationMinutes*60000+padding).toISOString();
  const [reservations,blocks,connection]=await Promise.all([
   db.from('resource_reservations').select('during',{count:'exact'}).eq('organization_id',input.organization).in('resource_id',input.resources).eq('active',true).overlaps('during',`[${begin},${finish})`).limit(1001),
   db.from('availability_exceptions').select('starts_at,ends_at',{count:'exact'}).eq('organization_id',input.organization).lt('starts_at',finish).gt('ends_at',begin).limit(1001),
   accessToken(input.organization),
  ]);
  if(reservations.error||blocks.error||reservations.count===null||blocks.count===null||reservations.count>1000||blocks.count>1000||reservations.data.length!==reservations.count||blocks.data.length!==blocks.count||!connection.account.calendar_id)throw Error('UNVERIFIED');
  const external=await busyTimes(connection.token,connection.account.calendar_id,begin,finish);
  const intervals=[...external.busy.map(v=>({start:Date.parse(v.start),end:Date.parse(v.end)})),...blocks.data.map(v=>({start:Date.parse(v.starts_at),end:Date.parse(v.ends_at)})),...reservations.data.map(v=>{
   const range=/^\["?([^",]+)"?,"?([^"\)]+)"?\)$/.exec(v.during);if(!range)throw Error('RANGE');return {start:Date.parse(range[1]!),end:Date.parse(range[2]!)};
  })];
  if(intervals.some(v=>!Number.isFinite(v.start)||!Number.isFinite(v.end)||v.end<=v.start))throw Error('RANGE');
  const validUntil=Date.parse(external.checkedAt)+60000;
  const result=recurringPreview({...input,timezone,clock:Date.now(),rules:ctx.settings.scheduling,busy:intervals,verifiedUntil:validUntil});
  if(Date.now()>=validUntil)throw Error('STALE');
  return reply(result);
 }catch{return reply({error:'The weekly schedule could not be checked. Refresh, confirm your settings and Google connection, then try again. No appointments were booked.'},409);}
}
