import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
const headers={'Cache-Control':'private, no-store'};
const messages:Record<string,string>={STALE_REVISION:'This appointment changed. Refresh the request before canceling.',WORK_STARTED:'Work has already started or been completed. Review the service workflow before changing this visit.',TRANSITION:'This appointment is no longer available to cancel.',IDEMPOTENCY_CONFLICT:'This retry has different details. Refresh the request.',FORBIDDEN:'Owner access is required.'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>6000)return NextResponse.json({error:'Reason is too long.'},{status:413,headers});
  const v=z.object({organizationId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),reason:z.string().trim().min(2).max(1000),key:z.string().min(16).max(128)}).strict().parse(JSON.parse(raw));
  const {db}=await authenticated();
  const r=await db.rpc('cancel_owner_appointment',{p_org:v.organizationId,p_id:v.id,p_revision:v.revision,p_reason:v.reason,p_key:v.key});
  if(r.error)return NextResponse.json({error:messages[r.error.message]||'The appointment was not canceled. Refresh and review its current status.'},{status:r.error.code==='42501'?403:409,headers});
  return NextResponse.json({ok:true,result:r.data},{headers});
 }catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'Enter a short cancellation reason for the customer.'},{status:400,headers});return failure(e);}
}
