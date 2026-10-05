import {NextResponse} from 'next/server';
import {z} from 'zod';
import {companySettings} from '../../../../../packages/contracts/index';
import {feasible} from '../../../../../packages/domain/scheduling';
import {localInstant} from '../../../../../packages/domain/timezone';
import {accessToken,serverDatabase} from '../../../lib/google-server';
import {busyTimes} from '../../../lib/google-core';
import {addDays,localDay} from '../../../../../lib/appointment-window.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const unavailable=(stage:string)=>{console.warn('public_availability_unavailable',{stage});return NextResponse.json({error:'Open times are unavailable. Please contact the business to arrange a visit.'},{status:503,headers:{'Cache-Control':'no-store'}});};
export async function GET(){
 let stage='activation';
 try{
  // Tenant and activation are server-controlled. Visitors cannot choose another company or inspect events.
  if(process.env.PUBLIC_AVAILABILITY_ENABLED!=='true')return unavailable(stage);
  stage='organization';
  const org=z.uuid().parse(process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID),db=serverDatabase(),clock=Date.now(),first=localDay(clock),last=addDays(first,30);
  stage='entitlement';
  const entitlement=await db.from('entitlements').select('enabled').eq('organization_id',org).eq('module','scheduling').eq('enabled',true).maybeSingle();
  if(entitlement.error||!entitlement.data)return unavailable(stage);
  stage='published_configuration';
  const cfg=await db.from('configuration_versions').select('version,settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).single();
  if(cfg.error)return unavailable(stage);
  stage='configuration_validation';
  const settings=z.object({timezone:companySettings.shape.timezone,scheduling:companySettings.shape.scheduling}).parse(cfg.data.settings);
  if(settings.timezone!=='America/Chicago'||settings.scheduling.bufferMinutes===null)return unavailable(stage);
  stage='operator';
  const operators=await db.from('resources').select('id').eq('organization_id',org).eq('kind','operator').eq('status','available').limit(2);
  if(operators.error||operators.data?.length!==1)return unavailable(stage);
  stage='window';
  const operator=operators.data[0]!.id,end=localInstant(addDays(last,1)+'T00:00',settings.timezone),begin=new Date(clock).toISOString(),finish=new Date(end+86400000).toISOString();
  // Bound response sizes and fail closed if more data needs pagination. Return slots only, never private rows.
  stage='calendar_and_reservations';
  const [reservations,blocks,account]=await Promise.all([
   db.from('resource_reservations').select('during',{count:'exact'}).eq('organization_id',org).eq('resource_id',operator).eq('active',true).overlaps('during',`[${begin},${finish})`).limit(1001),
   db.from('availability_exceptions').select('starts_at,ends_at',{count:'exact'}).eq('organization_id',org).lt('starts_at',finish).gt('ends_at',begin).limit(1001),
   accessToken(org),
  ]);
  if(reservations.error||blocks.error||reservations.count===null||blocks.count===null||reservations.count>1000||blocks.count>1000||reservations.data.length!==reservations.count||blocks.data.length!==blocks.count||!account.account.calendar_id)return unavailable(stage);
  stage='google_busy_times';
  const external=await busyTimes(account.token,account.account.calendar_id,begin,finish),checkedAt=Date.parse(external.checkedAt);
  if(Date.now()-checkedAt>60000)return unavailable(stage);
  stage='busy_intervals';
  const busy=[...external.busy.map(t=>({start:Date.parse(t.start),end:Date.parse(t.end)})),...blocks.data.map(t=>({start:Date.parse(t.starts_at),end:Date.parse(t.ends_at)})),...reservations.data.map(t=>{
   const match=/^\["?([^",]+)"?,"?([^"\)]+)"?\)$/.exec(t.during);
   if(!match)throw Error('INVALID_INTERVAL');return {start:Date.parse(match[1]!),end:Date.parse(match[2]!)};
  })];
  if(busy.some(t=>!Number.isFinite(t.start)||!Number.isFinite(t.end)||t.end<=t.start))return unavailable(stage);
  stage='slot_generation';
  const buffer=settings.scheduling.bufferMinutes*60000,expanded=busy.map(t=>({start:t.start-buffer,end:t.end+buffer})),times=[];
  for(let day=first;day<=last;day=addDays(day,1)){
   const weekday=new Date(day+'T12:00:00Z').getUTCDay();if(weekday===0||weekday===6)continue;
   const noon=localInstant(day+'T12:00',settings.timezone);
   for(let minute=480;minute<=900;minute+=30){
    const start=noon+(minute-720)*60000;
    try{const slot=feasible({start,clock,durationMinutes:120,timezone:settings.timezone,rules:settings.scheduling,busy:expanded,externalBusyVerifiedUntil:checkedAt+60000});times.push({start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString()});}catch{/* No candidate is offered when any feasibility check fails. */}
   }
  }
  if(Date.now()>=checkedAt+60000)return unavailable(stage);
  return NextResponse.json({times,timezone:settings.timezone,validUntil:new Date(checkedAt+60000).toISOString(),reserved:false},{headers:{'Cache-Control':'no-store'}});
 }catch{return unavailable(stage);}
}
