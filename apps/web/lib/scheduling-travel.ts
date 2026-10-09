import type {SupabaseClient} from '@supabase/supabase-js';
import {googleRouteProvider} from './google-routes.ts';
export async function schedulingTravel(db:SupabaseClient,org:string,requestId:string,appointmentId:string|null,resources:string[],operatorIds:string[],start:number,end:number,timezone:string,buffer:number){
 const provider=googleRouteProvider();if(!provider)return {before:0,after:0,status:'unavailable' as const};
 const operators=resources.filter(id=>operatorIds.includes(id));if(!operators.length)throw Error('INVALID_RESOURCES');
 const request=await db.from('service_requests').select('original_submission').eq('organization_id',org).eq('id',requestId).single();if(request.error)throw Error('ROUTE_UNAVAILABLE');
 const address=(r:Record<string,string>)=>[r.street,r.city].filter(Boolean).join(', '),destination=address(request.data.original_submission);if(!destination)throw Error('ROUTE_ADDRESS_REQUIRED');
 const reservations=await db.from('resource_reservations').select('appointment_id,resource_id',{count:'exact'}).eq('organization_id',org).eq('active',true).in('resource_id',operators).range(0,999);
 if(reservations.error||reservations.count===null||reservations.count!==reservations.data.length)throw Error('ROUTE_UNAVAILABLE');
 const ids=[...new Set(reservations.data.map(r=>r.appointment_id))].filter(id=>id!==appointmentId);if(!ids.length)return {before:0,after:0,status:'verified' as const};
 const appointments=await db.from('appointments').select('id,start_at,end_at,arrival_at,request:service_requests!appointments_organization_id_request_id_fkey(original_submission)',{count:'exact'}).eq('organization_id',org).eq('status','reserved').in('id',ids).range(0,999);
 if(appointments.error||appointments.count===null||appointments.count!==appointments.data.length)throw Error('ROUTE_UNAVAILABLE');
 const date=(value:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const legs:Promise<{side:'before'|'after';minutes:number}>[]=[];
 for(const operator of operators){
  const relevant=new Set(reservations.data.filter(r=>r.resource_id===operator).map(r=>r.appointment_id));
  const day=appointments.data.filter(a=>relevant.has(a.id)&&date(Date.parse(a.start_at))===date(start));
  const previous=day.filter(a=>Date.parse(a.end_at)<=start).sort((a,b)=>Date.parse(b.end_at)-Date.parse(a.end_at))[0];
  const next=day.filter(a=>Date.parse(a.start_at)>=end).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at))[0];
  for(const [side,a] of [['before',previous],['after',next]] as const){if(!a)continue;
   if(a.arrival_at!==a.start_at)throw Error('ROUTE_PICKUP_REVIEW');
   const linked=Array.isArray(a.request)?a.request[0]:a.request,other=address(linked?.original_submission||{});if(!other)throw Error('ROUTE_ADDRESS_REQUIRED');
   const departure=side==='before'?Date.parse(a.end_at):end;if(departure<=Date.now())throw Error('ROUTE_DEPARTURE_PAST');
   legs.push(provider(side==='before'?other:destination,side==='before'?destination:other,new Date(departure).toISOString()).then(estimate=>{const minutes=Math.ceil(estimate.minutes),gap=(side==='before'?start-Date.parse(a.end_at):Date.parse(a.start_at)-end)/60000;if(minutes>gap)throw Error('ROUTE_TRAVEL_CONFLICT');return {side,minutes};}));
  }
 }
 const facts=await Promise.all(legs);
 return {before:Math.max(0,...facts.filter(f=>f.side==='before').map(f=>f.minutes-buffer)),after:Math.max(0,...facts.filter(f=>f.side==='after').map(f=>f.minutes-buffer)),status:'verified' as const};
}
