import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {customerProfileCommand,customerProfileReceipt} from '../../../lib/customer-profile-contract';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();
  if(Buffer.byteLength(raw)>4096)return NextResponse.json({error:'Your details are too long.'},{status:413,headers});
  let input:unknown;try{input=JSON.parse(raw);}catch{return NextResponse.json({error:'Check your contact and address details.'},{status:400,headers});}
  const parsed=customerProfileCommand.safeParse(input);
  if(!parsed.success)return NextResponse.json({error:'Check your name, phone and service address.'},{status:400,headers});
  const organization=z.uuid().safeParse(process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID);
  if(!organization.success)return NextResponse.json({error:'Account setup is temporarily unavailable. You can still request service as a guest.'},{status:503,headers});
  const {db}=await authenticated();
  const result=await db.rpc('create_customer_profile',{p_org:organization.data,p_key:parsed.data.key,p_profile:parsed.data.profile});
  if(result.error){
   const denied=result.error.code==='42501',exists=result.error.message==='PROFILE_EXISTS';
   return NextResponse.json({error:denied?'Your account connection needs review. Contact the business before creating another profile.':exists?'Your details are already connected. Reload your account to continue.':'We could not confirm your saved details. Check the same saved attempt before changing them.'},{status:denied?403:exists?409:503,headers});
  }
  const receipt=customerProfileReceipt.safeParse(result.data);
  if(!receipt.success||receipt.data.organization!==organization.data)return NextResponse.json({error:'We could not confirm your saved details. Check the same saved attempt before changing them.'},{status:503,headers});
  return NextResponse.json(receipt.data,{headers});
 }catch(e){return failure(e);}
}
