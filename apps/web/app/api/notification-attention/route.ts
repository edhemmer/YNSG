import {NextResponse} from 'next/server';import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {mailAttentionKinds,mailAttentionDueFilter} from '../../../lib/notification-attention';
import {mailTransport} from '../../../lib/transactional-mail';
import {mailDeliveryReady} from '../../../lib/mail-delivery-readiness';
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams;const org=z.uuid().parse(q.get('organization'));const page=z.coerce.number().int().min(0).max(100000).parse(q.get('page')||0);
 const {db}=await authenticated();const permission=await db.rpc('mail_delivery_status',{p_org:org});if(permission.error)return NextResponse.json({error:'Owner access is required.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 const now=new Date().toISOString();const from=page*25;
 const r=await db.from('outbox').select('id,kind,status,object_id,created_at,next_attempt_at,lease_until,attempts',{count:'exact'}).eq('organization_id',org)
 .in('kind',mailAttentionKinds)
 .in('status',['pending','failed','leased','sending','needs_reconciliation','dead_letter']).or(mailAttentionDueFilter(now)).order('created_at').order('id').range(from,from+24);
 if(r.error||r.count===null)throw Error('FAILED');
 if(r.data.length!==Math.max(0,Math.min(25,r.count-from)))throw Error('INCOMPLETE_QUEUE');
 return NextResponse.json({records:r.data,total:r.count,page,hasMore:from+r.data.length<r.count,enabled:mailDeliveryReady(permission.data?.enabled===true,await mailTransport(org),process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'),checkedAt:now},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e)}}
