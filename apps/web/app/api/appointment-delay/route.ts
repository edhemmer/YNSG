import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
export const dynamic='force-dynamic';
const input=z.object({organization:z.uuid(),appointment:z.uuid(),revision:z.number().int().positive(),minutes:z.number().int().min(5).max(60),key:z.string().min(16).max(128)}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});
 try{
  const text=await request.text();if(Buffer.byteLength(text)>2048)return NextResponse.json({error:'Request too large.'},{status:413});
  const v=input.parse(JSON.parse(text)),{db}=await authenticated();
  const result=await db.rpc('request_delay_notice',{p_org:v.organization,p_appointment:v.appointment,p_revision:v.revision,p_minutes:v.minutes,p_key:v.key});
  if(result.error){const messages:Record<string,string>={FORBIDDEN:'Owner access is required.',TODAY_ONLY:'Delay notices are available for today’s upcoming or active visits.',STALE_REVISION:'This visit changed. Refresh before sending.',GMAIL_RECEIPT_REQUIRED:'Customer email delivery is not active. Call the customer.',CUSTOMER_EMAIL_REQUIRED:'The customer’s email needs review. Call the customer.',DELAY_ALREADY_QUEUED:'A delay notice was already queued in the last five minutes. Check Activity for its delivery status.'};return NextResponse.json({error:messages[result.error.message]||'The delay notice was not queued. Refresh and try again.'},{status:409,headers:{'Cache-Control':'no-store'}});}
  return NextResponse.json(result.data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
