import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {localMinute} from '../../../../../packages/domain/timezone';
import {snapshotWindow} from '../../../lib/business-snapshot';
import {weeklyBookedHours,leadSourceCounts,sourceOutcomes} from '../../../lib/growth-scorecard';
export const dynamic='force-dynamic';
// Read-only owner scorecard for the Growth Playbook gates. It never writes, books or prices anything.
export async function GET(request:Request){
 try{
  const {db,user}=await authenticated(),q=new URL(request.url).searchParams;
  const org=z.uuid().parse(q.get('organization'));
  const membership=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(membership.error||!membership.data)return NextResponse.json({error:'Owner access is required.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const company=await db.from('organizations').select('timezone').eq('id',org).single();
  if(company.error)throw Error('FAILED');
  const timezone=company.data.timezone,now=Date.now(),today=localMinute(now,timezone).slice(0,10),month=snapshotWindow(today.slice(0,7)+'-01',today,timezone);
  const since=new Date(now-9*7*86400000).toISOString(),sourcesSince=new Date(now-90*86400000).toISOString();
  const [jobs,visits,sources,finance,quoteRows,jobRows,invoiceRows]=await Promise.all([
   db.from('jobs').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('status','completed'),
   db.from('appointments').select('start_at,end_at').eq('organization_id',org).eq('status','reserved').gte('start_at',since).lt('start_at',new Date(now+7*86400000).toISOString()).limit(2000),
   db.from('service_requests').select('id,lead:original_submission->>leadSource').eq('organization_id',org).gte('created_at',sourcesSince).limit(5000),
   db.rpc('finance_activity',{p_org:org,p_from:today.slice(0,7)+'-01',p_to:today}),
   db.from('quotes').select('id,request_id').eq('organization_id',org).gte('created_at',sourcesSince).limit(5000),
   db.from('jobs').select('id,quote_id,status').eq('organization_id',org).gte('created_at',sourcesSince).limit(5000),
   db.from('invoices').select('job_id,total_cents').eq('organization_id',org).gte('issued_at',sourcesSince).limit(5000),
  ]);
  if(jobs.error||!Number.isSafeInteger(jobs.count)||visits.error||sources.error||finance.error||!finance.data||quoteRows.error||jobRows.error||invoiceRows.error)throw Error('FAILED');
  const visitRows=z.array(z.object({start_at:z.string(),end_at:z.string()})).parse(visits.data);
  const sourceRows=z.array(z.object({id:z.string(),lead:z.string().nullable()})).parse(sources.data);
  const outcomes=sourceOutcomes(sourceRows,z.array(z.object({id:z.string(),request_id:z.string()})).parse(quoteRows.data),z.array(z.object({id:z.string(),quote_id:z.string(),status:z.string()})).parse(jobRows.data),z.array(z.object({job_id:z.string(),total_cents:z.number().int()})).parse(invoiceRows.data));
  const collected=z.object({cashReceivedCents:z.number().int().nonnegative()}).parse(finance.data).cashReceivedCents;
  const monthHours=visitRows.reduce((sum,v)=>{const s=Date.parse(v.start_at),e=Date.parse(v.end_at);return s>=Date.parse(month.start)&&s<Date.parse(month.end)&&e>s&&e-s<=16*3600000?sum+(e-s)/3600000:sum;},0);
  return NextResponse.json({checkedAt:new Date(now).toISOString(),timezone,completedJobs:jobs.count,weeks:weeklyBookedHours(visitRows,now,timezone,8),sources:leadSourceCounts(sourceRows.map(r=>r.lead)),outcomes,sourceWindowDays:90,month:{collectedCents:collected,bookedHours:Math.round(monthHours*10)/10},truncated:visitRows.length>=2000||sourceRows.length>=5000||(quoteRows.data?.length??0)>=5000||(jobRows.data?.length??0)>=5000||(invoiceRows.data?.length??0)>=5000},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return failure(e)}
}
