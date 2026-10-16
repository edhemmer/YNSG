import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
const headers={'Cache-Control':'private, no-store'};
const command=z.object({organization:z.uuid(),customer:z.uuid(),user:z.uuid(),action:z.enum(['revoke','capabilities']),canApprove:z.boolean().default(false),canViewBilling:z.boolean().default(false)}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();
  if(Buffer.byteLength(raw)>4096)return NextResponse.json({error:'Request too large.'},{status:413,headers});
  const parsed=command.safeParse(JSON.parse(raw));
  if(!parsed.success)return NextResponse.json({error:'Check the customer access change.'},{status:400,headers});
  const v=parsed.data;const {db}=await authenticated();
  const r=await db.rpc('manage_customer_delegate',{p_org:v.organization,p_customer:v.customer,p_user:v.user,p_action:v.action,p_can_approve:v.canApprove,p_can_view_billing:v.canViewBilling});
  if(r.error){const denial=r.error.code==='42501';return NextResponse.json({error:denial?'This account cannot change that customer access.':'Customer access result could not be confirmed. Reload to verify current access.'},{status:denial?403:503,headers});}
  const receipt=z.object({customer:z.uuid(),user:z.uuid(),revoked:z.boolean(),canApprove:z.boolean(),canViewBilling:z.boolean(),changed:z.boolean()}).safeParse(r.data);
  if(!receipt.success||receipt.data.customer!==v.customer||receipt.data.user!==v.user)return NextResponse.json({error:'Customer access result could not be confirmed. Reload to verify current access.'},{status:503,headers});
  return NextResponse.json({result:receipt.data},{headers});
 }catch(e){return failure(e)}
}
