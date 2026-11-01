import {NextResponse} from 'next/server';
import {messageQuery,messageQueue} from '../../../lib/notification-contract';
import {authenticated,failure} from '../../../lib/session';
import {mailAttentionKinds,mailAttentionDueFilter} from '../../../lib/notification-attention';
import {mailTransport} from '../../../lib/transactional-mail';
import {mailDeliveryReady} from '../../../lib/mail-delivery-readiness';
export async function GET(request:Request){try{
 const {organization:org,page,view}=messageQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
 const {db}=await authenticated();const permission=await db.rpc('mail_delivery_status',{p_org:org});if(permission.error)return NextResponse.json({error:'Owner access is required.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 const now=new Date().toISOString();const from=page*25;
 let query=db.from('outbox').select('id,kind,status,object_id,created_at,next_attempt_at,lease_until,attempts',{count:'exact'}).eq('organization_id',org)
 .in('kind',mailAttentionKinds)
 ;
 query=view==='attention'?query.in('status',['pending','failed','leased','sending','needs_reconciliation','dead_letter']).or(mailAttentionDueFilter(now)):query.or('kind.neq.invoice.paid,and(kind.eq.invoice.paid,payload->>schemaVersion.eq.2)');
 const r=await query.order('created_at',{ascending:view==='attention'}).order('id',{ascending:view==='attention'}).range(from,from+24);
 if(r.error||r.count===null)throw Error('FAILED');
 if(r.data.length!==Math.max(0,Math.min(25,r.count-from)))throw Error('INCOMPLETE_QUEUE');
 const appointmentIds=[...new Set(r.data.filter(row=>row.kind.startsWith('appointment.')).map(row=>row.object_id))];
 const appointmentRequests=new Map<string,string>();
 if(appointmentIds.length){const appointments=await db.from('appointments').select('id,request_id').eq('organization_id',org).in('id',appointmentIds);if(appointments.error)throw Error('FAILED');for(const row of appointments.data||[])if(row.request_id)appointmentRequests.set(row.id,row.request_id);}
 const records=r.data.map(row=>({...row,request_id:row.kind.startsWith('request.')?row.object_id:appointmentRequests.get(row.object_id)||null}));
 const result=messageQueue.safeParse({organization:org,view,records,total:r.count,page,hasMore:from+r.data.length<r.count,enabled:mailDeliveryReady(permission.data?.enabled===true,await mailTransport(org),process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'),checkedAt:now});if(!result.success)throw Error('INVALID_RESPONSE');
 return NextResponse.json(result.data,{headers:{'Cache-Control':'private, no-store'}});
}catch(e){if(e instanceof Error&&e.message==='UNAUTHORIZED')return failure(e);if(e instanceof Error&&e.name==='ZodError')return NextResponse.json({error:'Invalid message query or response.'},{status:400,headers:{'Cache-Control':'private, no-store'}});return NextResponse.json({error:'Message activity could not be loaded. Please try again.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}}
