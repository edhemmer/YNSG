import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {snapshotWindow} from '../../../lib/business-snapshot';
import {mailTransport} from '../../../lib/transactional-mail';
import {mailAttentionKinds,mailAttentionDueFilter} from '../../../lib/notification-attention';
import {mailDeliveryReady} from '../../../lib/mail-delivery-readiness';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const {db,user}=await authenticated(),q=new URL(request.url).searchParams;
  const org=z.uuid().parse(q.get('organization')),from=z.iso.date().parse(q.get('from')),to=z.iso.date().parse(q.get('to'));
  const membership=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(membership.error||!membership.data)return NextResponse.json({error:'Owner access is required.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const company=await db.from('organizations').select('timezone').eq('id',org).single();
  if(company.error)throw Error('FAILED');
  const window=snapshotWindow(from,to,company.data.timezone),now=new Date().toISOString();
  const count=(table:string)=>db.from(table).select('id',{count:'exact',head:true}).eq('organization_id',org);
  const emailCount=()=>count('outbox').in('kind',mailAttentionKinds).or(mailAttentionDueFilter(now));
  const calls=[
   count('customers'),count('service_requests').gte('created_at',window.start).lt('created_at',window.end),
   count('service_requests').in('status',['submitted','reviewing']),
   count('appointments').eq('status','reserved').gte('end_at',now),
   count('appointments').eq('status','proposal').gt('expires_at',now),
   count('jobs').eq('status','working'),count('jobs').eq('status','paused'),count('jobs').eq('status','completed'),
   count('quotes').eq('status','sent'),
   emailCount().in('status',['pending','failed','leased','sending','needs_reconciliation','dead_letter']),
   count('customer_schedule_preferences').eq('status','pending'),
   emailCount().in('status',['failed','needs_reconciliation','dead_letter']),
   db.from('jobs').select('id,invoices(id)',{count:'exact',head:true}).eq('organization_id',org).eq('status','completed').is('invoices','null'),
   count('jobs').in('status',['approved','scheduled','en_route','arrived']),
  ];
  const [counts,finance,email,connections,transport,workSchedule]=await Promise.all([Promise.all(calls),db.rpc('finance_activity',{p_org:org,p_from:from,p_to:to}),db.rpc('mail_delivery_status',{p_org:org}),db.from('integration_connections').select('provider,status').eq('organization_id',org),mailTransport(org),db.rpc('job_schedule_readiness',{p_org:org})]);
  if(workSchedule.error||!workSchedule.data)throw Error('FAILED');
  const scheduleCounts=z.object({ready:z.number().int().nonnegative(),needsReview:z.number().int().nonnegative()}).parse(workSchedule.data);
  if(counts.some(r=>r.error||!Number.isSafeInteger(r.count)||r.count!<0)||finance.error||!finance.data||email.error||connections.error)throw Error('FAILED');
  const nonnegative=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const money=z.object({cashReceivedCents:nonnegative,expenseCents:nonnegative,cashAfterExpensesCents:z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),issuedInvoicesCents:nonnegative,outstandingAsOfEndCents:nonnegative,paymentCount:nonnegative,expenseCount:nonnegative}).parse(finance.data);
  const keys=['customers','requestsInPeriod','requestsToReview','upcomingVisits','proposals','working','paused','completed','quotes','messagesToCheck','rescheduleRequests','deliveryExceptions','jobsNeedingInvoice','jobsReadyToStart'];
  return NextResponse.json({checkedAt:new Date().toISOString(),from,to,timezone:company.data.timezone,finance:money,counts:{...Object.fromEntries(keys.map((k,i)=>[k,counts[i].count])),jobsReadyToStart:scheduleCounts.ready,jobsNeedingSchedule:scheduleCounts.needsReview},email:{enabled:email.data.enabled===true,automaticSending:mailDeliveryReady(email.data.enabled===true,transport,process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true')},connections:connections.data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return failure(e)}
}
