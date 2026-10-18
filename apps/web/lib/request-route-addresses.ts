import type {SupabaseClient} from '@supabase/supabase-js';
import {addressInput} from '../../../lib/address-check.js';
export type RouteAddressRequest={key:string;requestId:string;submission:Record<string,unknown>};
const text=(value:unknown)=>typeof value==='string'?value:'';
const version=(value:unknown)=>((typeof value==='string'&&/^[1-9]\d*$/.test(value))||typeof value==='number')&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
function formatted(s:Record<string,unknown>,state:unknown):string|null{
 try{const a=addressInput({street:text(s.street),city:text(s.city),state:text(state),postalCode:text(s.zip||s.postal_code||s.postalCode)});return [a.street,a.city,a.state,a.postalCode].filter(Boolean).join(', ');}catch{return null;}
}
// Read only immutable intake evidence, in bounded batches. Never infer a state
// from today's settings, a mutable property, postal text or the provider.
export async function requestRouteAddresses(db:SupabaseClient,org:string,requests:RouteAddressRequest[]):Promise<Map<string,string|null>>{
 if(requests.length>1000)throw Error('ROUTE_UNAVAILABLE');
 const result=new Map<string,string|null>();
 const legacy=requests.filter(r=>{const s=r.submission;result.set(r.key,formatted(s,s.state||s.region));return !s.state&&!s.region&&!!r.requestId&&typeof s.street==='string'&&typeof s.city==='string';});
 const ids=[...new Set(legacy.map(r=>r.requestId))],versions=new Map<string,number|null>();
 for(let offset=0;offset<ids.length;offset+=100){
  const batch=ids.slice(offset,offset+100),saved=await db.from('outbox').select('object_id,configuration_version:payload->>configurationVersion',{count:'exact'}).eq('organization_id',org).eq('kind','request.owner_notification').in('object_id',batch).order('object_id').range(0,100);
  if(saved.error||!saved.data||saved.count===null||saved.count!==saved.data.length||saved.count>100)throw Error('ROUTE_UNAVAILABLE');
  for(const row of saved.data){if(!batch.includes(row.object_id))throw Error('ROUTE_UNAVAILABLE');versions.set(row.object_id,versions.has(row.object_id)?null:version(row.configuration_version));}
 }
 const unique=[...new Set([...versions.values()].filter((v):v is number=>v!==null))];
 const configs=new Map<number,{region:unknown;cities:unknown}|null>();
 for(let offset=0;offset<unique.length;offset+=100){
  const batch=unique.slice(offset,offset+100),saved=await db.from('configuration_versions').select('version,region:settings->>region,cities:settings->cities',{count:'exact'}).eq('organization_id',org).in('version',batch).order('version').range(0,100);
  if(saved.error||!saved.data||saved.count===null||saved.count!==saved.data.length||saved.count>100)throw Error('ROUTE_UNAVAILABLE');
  for(const row of saved.data){const v=version(row.version);if(v===null||!batch.includes(v))throw Error('ROUTE_UNAVAILABLE');configs.set(v,configs.has(v)?null:{region:row.region,cities:row.cities});}
 }
 for(const r of legacy){const v=versions.get(r.requestId),c=v?configs.get(v):null;if(c&&Array.isArray(c.cities)&&c.cities.includes(r.submission.city))result.set(r.key,formatted(r.submission,c.region));}
 return result;
}
