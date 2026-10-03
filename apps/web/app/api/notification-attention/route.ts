import {NextResponse} from 'next/server';import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams;const org=z.uuid().parse(q.get('organization'));const page=z.coerce.number().int().min(0).max(100000).parse(q.get('page')||0);
 const {db}=await authenticated();const permission=await db.rpc('mail_delivery_status',{p_org:org});if(permission.error)return NextResponse.json({error:'Owner access is required.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 const now=new Date().toISOString();const from=page*25;
 const r=await db.from('outbox').select('id,kind,status,object_id,created_at,next_attempt_at,lease_until,attempts',{count:'exact'}).eq('organization_id',org)
 .in('kind',['request.owner_notification','request.declined','invoice.delivery','invoice.paid','appointment.owner_approval','appointment.confirmation','appointment.reminder','appointment.owner_reminder','appointment.declined_time','appointment.declined_service','appointment.reschedule_requested'])
 .in('status',['pending','failed','leased','sending','needs_reconciliation','dead_letter']).or(`and(kind.neq.invoice.paid,or(status.in.(needs_reconciliation,dead_letter),next_attempt_at.lte.${now})),and(kind.eq.invoice.paid,payload->>schemaVersion.eq.2,or(status.in.(needs_reconciliation,dead_letter),next_attempt_at.lte.${now}))`).order('created_at').order('id').range(from,from+24);
 if(r.error||r.count===null)throw Error('FAILED');
 if(r.data.length!==Math.max(0,Math.min(25,r.count-from)))throw Error('INCOMPLETE_QUEUE');
 return NextResponse.json({records:r.data,total:r.count,page,hasMore:from+r.data.length<r.count,enabled:process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'&&permission.data?.enabled===true,checkedAt:now},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e)}}
