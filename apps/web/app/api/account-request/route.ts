import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {repeatRequest} from '../../../../../packages/contracts/customer-intake';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const org=z.uuid().parse(new URL(request.url).searchParams.get('organization'));
 const {db}=await authenticated();const r=await db.rpc('customer_intake_context',{p_org:org});
 if(r.error)return NextResponse.json({error:'Your saved details are not available for a new request. Contact the business to check your account connection.'},{status:403,headers});
 return NextResponse.json(r.data,{headers});
}catch(e){return failure(e)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
 const text=await request.text();if(Buffer.byteLength(text)>12000)return NextResponse.json({error:'Request too large.'},{status:413,headers});
 const parsed=repeatRequest.safeParse(JSON.parse(text));if(!parsed.success)return NextResponse.json({error:'Check your services and details before sending.'},{status:400,headers});
 const v=parsed.data;const {db}=await authenticated();const r=await db.rpc('submit_customer_request',{p_org:v.organization,p_contact:v.contact,p_property:v.property,p_key:v.key,p_input:v.input});
 if(r.error)return NextResponse.json({error:r.error.message==='RATE_LIMITED'?'Please wait before sending another request.':'Your request was not saved. Check your linked details or contact the business.'},{status:r.error.message==='RATE_LIMITED'?429:409,headers});
 return NextResponse.json({request:r.data},{headers});
 }catch(e){return failure(e)}
}
