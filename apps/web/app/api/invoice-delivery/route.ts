import {mailTransport} from '../../../lib/transactional-mail';
import {mailDeliveryReady} from '../../../lib/mail-delivery-readiness';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams;
 const organization=z.uuid().parse(q.get('organization')),invoice=z.uuid().parse(q.get('invoice'));
 const {db}=await authenticated();
 const permission=await db.rpc('mail_delivery_status',{p_org:organization});if(permission.error)throw permission.error;
 const record=await db.from('invoices').select('snapshot').eq('organization_id',organization).eq('id',invoice).maybeSingle();if(record.error)throw record.error;if(!record.data)return NextResponse.json({error:'Invoice unavailable.'},{status:404,headers});
 const delivery=await db.from('outbox').select('status').eq('organization_id',organization).eq('event_key',`invoice:${invoice}:delivery`).maybeSingle();if(delivery.error)throw delivery.error;
 const paid=await db.from('outbox').select('status,payload').eq('organization_id',organization).eq('event_key',`invoice:${invoice}:paid`).maybeSingle();if(paid.error)throw paid.error;
 return NextResponse.json({paidStatus:paid.data?.payload?.schemaVersion===2?paid.data.status:'not_queued',enabled:mailDeliveryReady(permission.data?.enabled===true,await mailTransport(organization),process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'),recipient:record.data.snapshot?.recipient?.email||null,status:delivery.data?.status||'not_requested'},{headers});
}catch(e){return failure(e)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
 const v=z.object({organization:z.uuid(),invoice:z.uuid(),reviewed:z.literal(true),key:z.string().min(16).max(128)}).strict().parse(await request.json());
 const {db}=await authenticated();
 const permission=await db.rpc('mail_delivery_status',{p_org:v.organization});if(permission.error)throw permission.error;
 if(!mailDeliveryReady(permission.data?.enabled===true,await mailTransport(v.organization),process.env.GOOGLE_GMAIL_DELIVERY_ENABLED==='true'))return NextResponse.json({error:'Business email is not ready. Verify the sender and enable notifications in Settings.'},{status:503,headers});
 const r=await db.rpc('request_invoice_delivery',{p_org:v.organization,p_invoice:v.invoice,p_reviewed:v.reviewed,p_key:v.key});
 if(r.error){
  const denied=r.error.code==='42501';
  const known=denied||['INVOICE_REVIEW_REQUIRED','SETUP_REQUIRED','IDEMPOTENCY_CONFLICT','NOT_FOUND','INVOICE_APPROVAL_REQUIRED','INVOICE_CUSTOMER_DETAILS_REQUIRED','GMAIL_RECEIPT_REQUIRED'].includes(r.error.message);
  return NextResponse.json({error:denied?'Your account cannot request invoice delivery.':known?'Check the issued invoice, recipient, and business email setup.':'The email queue result is uncertain. Check the same saved attempt before requesting another email.'},{status:denied?403:known?409:503,headers});
 }
 const receipt=z.object({id:z.uuid(),status:z.string().min(1)}).passthrough().safeParse(r.data);
 if(!receipt.success)return NextResponse.json({error:'The email queue result is uncertain. Check the same saved attempt before requesting another email.'},{status:503,headers});
 return NextResponse.json({delivery:receipt.data},{headers});
 }catch(e){return failure(e)}
}
