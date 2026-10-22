import type {SupabaseClient} from '@supabase/supabase-js';
import {ownerWorkResponse} from './owner-work.ts';
import {requestTasks} from './request-inbox.ts';
export async function readOwnerWork(db:SupabaseClient,org:string,userId:string,page:number){
 const access=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',userId).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
 if(access.error)throw Error('FAILED');if(!access.data)throw Error('OWNER_ACCESS_REQUIRED');
 // For the bounded status set, descending text order is working → paused → completed.
 // Apply priority before pagination so an older completed job cannot bury a running timer.
 const jobs=await db.from('jobs').select('id,quote_id,status,invoices(id)',{count:'exact'}).eq('organization_id',org).in('status',['working','paused','completed']).is('invoices','null').order('status',{ascending:false}).order('created_at').order('id').range(page*20,page*20+20);
 if(jobs.error||jobs.count===null)throw Error('FAILED');
 const pageJobs=jobs.data.slice(0,20),ids=pageJobs.map(j=>j.quote_id);
 const quotes=ids.length?await db.from('quotes').select('id,request_id').eq('organization_id',org).in('id',ids).limit(21):{data:[],error:null};
 if(quotes.error)throw Error('FAILED');
 const requests=quotes.data!.length?await db.from('service_requests').select('id,original_submission').eq('organization_id',org).in('id',quotes.data!.map(q=>q.request_id)).limit(21):{data:[],error:null};
 if(requests.error)throw Error('FAILED');
 const items=pageJobs.map(j=>{const q=quotes.data!.find(q=>q.id===j.quote_id),r=requests.data!.find(r=>r.id===q?.request_id);if(!r)throw Error('FAILED');const s=r.original_submission;return {job:j.id,request:r.id,name:s.name,address:[s.street,s.city].filter(Boolean).join(', '),tasks:requestTasks(s).map(t=>t.task||t.service),status:j.status};});
 return ownerWorkResponse.parse({checkedAt:new Date().toISOString(),page,total:jobs.count,hasMore:jobs.data.length>20,items});
}
