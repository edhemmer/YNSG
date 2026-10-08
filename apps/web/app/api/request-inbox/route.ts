import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {inboxSearch} from '../../../lib/request-inbox';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams,org=z.uuid().parse(q.get('organization'));
  const page=z.coerce.number().int().min(0).max(100000).parse(q.get('page')||0),filter=z.enum(['review','all','closed']).parse(q.get('filter')||'review');
  const selected=q.get('request');if(selected)z.uuid().parse(selected);
  const search=inboxSearch(z.string().max(200).parse(q.get('search')||''));
  const {db,user}=await authenticated();
  const access=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin','dispatcher']).maybeSingle();
  if(access.error||!access.data)return NextResponse.json({error:'Your account cannot review requests for this business.'},{status:403,headers});
  let records=db.from('service_requests').select('id,status,revision,created_at,original_submission,appointments!appointments_organization_id_request_id_fkey(id,request_id,status,revision,start_at,end_at,arrival_at,expires_at,replaces_id,customer_response)',{count:'exact'}).eq('organization_id',org);
  if(selected)records=records.eq('id',selected);
  else{
   if(filter==='review')records=records.in('status',['submitted','reviewing','quoted']);
   if(filter==='closed')records=records.in('status',['declined','canceled']);
   if(search)records=records.or(['name','street','city','email','phone'].map(field=>`original_submission->>${field}.ilike.*${search}*`).join(','));
  }
  const [rows,count]=await Promise.all([records.order('created_at',{ascending:false}).order('id').range(page*20,page*20+19),db.from('service_requests').select('id',{count:'exact',head:true}).eq('organization_id',org).in('status',['submitted','reviewing'])]);
  if(rows.error||count.error||rows.count===null||count.count===null)throw Error('FAILED');
  const ids=rows.data.map(r=>r.id);
  const [quotes,preferences]=ids.length?await Promise.all([
   db.from('quotes').select('id,request_id,status,current_version,quote_versions(version,scope,labor_cents,duration_minutes)').eq('organization_id',org).in('request_id',ids).order('id').limit(1001),
   db.from('customer_schedule_preferences').select('id,request_id,preferred_local_start,note,timezone').eq('organization_id',org).in('request_id',ids).eq('status','pending').limit(1001)
  ]):[{data:[],error:null},{data:[],error:null}];
  if(quotes.error||preferences.error||quotes.data!.length>1000||preferences.data!.length>1000)throw Error('FAILED');
  const quoteIds=quotes.data!.map(v=>v.id);
  const jobs=quoteIds.length?await db.from('jobs').select('id,quote_id,status,revision').eq('organization_id',org).in('quote_id',quoteIds).limit(1001):{data:[],error:null};
  if(jobs.error||jobs.data!.length>1000)throw Error('FAILED');
  const jobIds=jobs.data!.map(v=>v.id);
  const invoices=jobIds.length?await db.from('invoices').select('id,job_id,number,total_cents,payments(cents)').eq('organization_id',org).in('job_id',jobIds).limit(1001):{data:[],error:null};
  if(invoices.error||invoices.data!.length>1000)throw Error('FAILED');
  return NextResponse.json({requests:rows.data,total:rows.count,needsReview:count.count,page,hasMore:(page+1)*20<rows.count,checkedAt:new Date().toISOString(),quotes:quotes.data,jobs:jobs.data,invoices:invoices.data,preferences:preferences.data},{headers});
 }catch(e){return failure(e);}
}
