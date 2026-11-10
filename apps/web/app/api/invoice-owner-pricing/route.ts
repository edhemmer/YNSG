import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {ownerPricingSchema,pricingTotals} from '../../../lib/owner-invoice-pricing';

export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams;
  const organization=z.uuid().parse(q.get('organization'));
  const job=z.uuid().parse(q.get('job'));
  const {db}=await authenticated();
  // RLS is not the boundary here: the RPC checks live owner/admin membership.
  const result=await db.rpc('invoice_owner_pricing_read',{p_org:organization,p_job:job});
  if(result.error)throw result.error;
  const pricing=result.data?ownerPricingSchema.parse(result.data):null;
  return NextResponse.json({pricing,totals:pricing?pricingTotals(pricing):null},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return failure(e)}
}
