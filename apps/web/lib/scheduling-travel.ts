import type {SupabaseClient} from '@supabase/supabase-js';
import {localMinute,localInstant} from '../../../packages/domain/timezone.ts';
import {addDays} from '../../../lib/appointment-window.js';
import {googleRouteProvider} from './google-routes.ts';
import {requestRouteAddresses} from './request-route-addresses.ts';
import type {RouteProvider} from './route-plan.ts';
export async function schedulingTravel(db:SupabaseClient,org:string,requestId:string,appointmentId:string|null,resources:string[],operatorIds:string[],start:number,end:number,timezone:string,buffer:number,provider:RouteProvider|null=googleRouteProvider()){
 const operators=resources.filter(id=>operatorIds.includes(id));if(!operators.length)throw Error('INVALID_RESOURCES');
 const request=await db.from('service_requests').select('original_submission').eq('organization_id',org).eq('id',requestId).single();if(request.error)throw Error('ROUTE_UNAVAILABLE');
 if(!request.data.original_submission?.street||!request.data.original_submission?.city)throw Error('ROUTE_ADDRESS_REQUIRED');
 const sameAddress=(a:string,b:string)=>a.toLowerCase().replace(/[^a-z0-9]/g,'')===b.toLowerCase().replace(/[^a-z0-9]/g,'');
 const dayStart=localMinute(start,timezone).slice(0,10),windowStart=new Date(localInstant(addDays(dayStart,-1)+'T00:00',timezone)).toISOString(),windowEnd=new Date(localInstant(addDays(dayStart,2)+'T00:00',timezone)).toISOString();
 const reservations=await db.from('resource_reservations').select('appointment_id,resource_id',{count:'exact'}).eq('organization_id',org).eq('active',true).in('resource_id',operators).overlaps('during',`[${windowStart},${windowEnd})`).range(0,999);
 if(reservations.error||reservations.count===null||reservations.count!==reservations.data.length)throw Error('ROUTE_UNAVAILABLE');
 const ids=[...new Set(reservations.data.map(r=>r.appointment_id))].filter(id=>id!==appointmentId);if(!ids.length)return {before:0,after:0,status:'verified' as const};
 const appointments=await db.from('appointments').select('id,start_at,end_at,arrival_at,request:service_requests!appointments_organization_id_request_id_fkey(id,original_submission)',{count:'exact'}).eq('organization_id',org).eq('status','reserved').in('id',ids).range(0,999);
 if(appointments.error||appointments.count===null||appointments.count!==appointments.data.length)throw Error('ROUTE_UNAVAILABLE');
 const adjacent:{side:'before'|'after';appointment:typeof appointments.data[number]}[]=[];
 for(const operator of operators){
  const relevant=new Set(reservations.data.filter(r=>r.resource_id===operator).map(r=>r.appointment_id));
  const day=appointments.data.filter(a=>relevant.has(a.id));
  if(day.some(a=>Date.parse(a.start_at)<end&&Date.parse(a.end_at)>start))throw Error('ROUTE_TRAVEL_CONFLICT');
  const previous=day.filter(a=>Date.parse(a.end_at)<=start).sort((a,b)=>Date.parse(b.end_at)-Date.parse(a.end_at))[0];
  const next=day.filter(a=>Date.parse(a.start_at)>=end).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at))[0];
  for(const [side,a] of [['before',previous],['after',next]] as const){if(!a)continue;
   if(a.arrival_at!==a.start_at)throw Error('ROUTE_PICKUP_REVIEW');
   adjacent.push({side,appointment:a});
  }
 }
 const addresses=await requestRouteAddresses(db,org,[{key:'destination',requestId,submission:request.data.original_submission},...adjacent.map(({appointment:a})=>{const linked=Array.isArray(a.request)?a.request[0]:a.request;return {key:a.id,requestId:linked?.id||'',submission:linked?.original_submission||{}};})]);
 const destination=addresses.get('destination');if(!destination)throw Error('ROUTE_ADDRESS_REQUIRED');
 if(adjacent.some(({appointment:a})=>!addresses.get(a.id)))throw Error('ROUTE_ADDRESS_REQUIRED');
 for(const {side,appointment:a} of adjacent){
  if((side==='before'?Date.parse(a.end_at):end)<=Date.now())throw Error('ROUTE_DEPARTURE_PAST');
  if(!provider&&!sameAddress(addresses.get(a.id)!,destination))throw Error('ROUTE_UNAVAILABLE');
 }
 const legs=adjacent.map(({side,appointment:a})=>{
   const other=addresses.get(a.id)!;
   const departure=side==='before'?Date.parse(a.end_at):end;
   const estimate=sameAddress(other,destination)?Promise.resolve({minutes:0,meters:0}):provider!(side==='before'?other:destination,side==='before'?destination:other,new Date(departure).toISOString());
   return estimate.then(result=>{const minutes=Math.ceil(result.minutes),gap=(side==='before'?start-Date.parse(a.end_at):Date.parse(a.start_at)-end)/60000;if(!Number.isFinite(minutes)||minutes<0)throw Error('ROUTE_UNAVAILABLE');if(minutes>gap)throw Error('ROUTE_TRAVEL_CONFLICT');return {side,minutes};});
 });
 const facts=await Promise.all(legs);
 return {before:Math.max(0,...facts.filter(f=>f.side==='before').map(f=>f.minutes-buffer)),after:Math.max(0,...facts.filter(f=>f.side==='after').map(f=>f.minutes-buffer)),status:'verified' as const};
}
