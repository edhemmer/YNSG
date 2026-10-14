import type {SupabaseClient} from '@supabase/supabase-js';
import {ownerDayResponse} from './owner-day.ts';
import {requestTasks} from './request-inbox.ts';
export async function readOwnerDay(db:SupabaseClient,org:string,userId:string,checkedAt=new Date().toISOString()){
 const access=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',userId).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
 if(access.error)throw Error('FAILED');
 if(!access.data)throw Error('OWNER_ACCESS_REQUIRED');
 const [company,visits]=await Promise.all([
  db.from('organizations').select('timezone').eq('id',org).single(),
  db.from('appointments').select('id,request_id,start_at,arrival_at,end_at,request:service_requests!appointments_organization_id_request_id_fkey(original_submission)').eq('organization_id',org).eq('status','reserved').gte('end_at',checkedAt).not('request_id','is',null).order('start_at').order('id').range(0,12)
 ]);
 if(company.error||visits.error)throw Error('FAILED');
 const calls=visits.data.slice(0,12).map(v=>{
  const r=Array.isArray(v.request)?v.request[0]:v.request;
  if(!r?.original_submission)throw Error('FAILED');
  const s=r.original_submission;
  return {id:v.id,requestId:v.request_id,startAt:v.start_at,arrivalAt:v.arrival_at||v.start_at,endAt:v.end_at,name:s.name,address:[s.street,s.city].filter(Boolean).join(', '),phone:s.phone,tasks:requestTasks(s).map(t=>t.task||t.service)};
 });
 return ownerDayResponse.parse({checkedAt,timezone:company.data.timezone,calls,hasMore:visits.data.length>12});
}
