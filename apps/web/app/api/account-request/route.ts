import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {repeatRequest,repeatRequestContext} from '../../../../../packages/contracts/customer-intake';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const org=z.uuid().safeParse(new URL(request.url).searchParams.get('organization'));
 if(!org.success)return NextResponse.json({error:'Choose a valid business.'},{status:400,headers});
 const {db}=await authenticated();const r=await db.rpc('customer_intake_context',{p_org:org.data});
 if(r.error){const denied=r.error.code==='42501'||r.error.message==='FORBIDDEN';return NextResponse.json({error:denied?'Your saved details are not available for this business. Contact the business to check your account connection.':'Your saved details could not be loaded. Please try again.'},{status:denied?403:503,headers});}
 const context=repeatRequestContext.safeParse(r.data);
 if(!context.success)return NextResponse.json({error:'Your saved details could not be loaded. Please try again.'},{status:503,headers});
 return NextResponse.json(context.data,{headers});
}catch(e){return failure(e)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
 const text=await request.text();if(Buffer.byteLength(text)>12000)return NextResponse.json({error:'Request too large.'},{status:413,headers});
 const parsed=repeatRequest.safeParse(JSON.parse(text));if(!parsed.success)return NextResponse.json({error:'Check your services and details before sending.'},{status:400,headers});
 const v=parsed.data;const {db}=await authenticated();const r=await db.rpc('submit_customer_request',{p_org:v.organization,p_contact:v.contact,p_property:v.property,p_key:v.key,p_input:v.input});
 if(r.error){if(r.error.message==='RATE_LIMITED')return NextResponse.json({error:'Please wait before sending another request.'},{status:429,headers});return NextResponse.json({error:'The request result could not be confirmed. Check the saved request result before changing the submission.'},{status:503,headers});}
 const receipt=z.object({id:z.uuid()}).passthrough().safeParse(r.data);
 if(!receipt.success)return NextResponse.json({error:'The request result could not be confirmed. Check the saved request result before changing the submission.'},{status:503,headers});
 return NextResponse.json({request:r.data},{headers});
 }catch(e){return failure(e)}
}
