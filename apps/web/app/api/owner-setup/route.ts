import {NextResponse} from 'next/server';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
export const dynamic='force-dynamic';
async function setup(claim:boolean){
 try {
  const {db}=await authenticated();
  const {data,error}=await db.rpc('owner_setup',{p_claim:claim});
  if(error)return NextResponse.json({error:'Owner setup requires a verified email sign-in and an active invitation.'},{status:403,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}
export async function GET(){return setup(false);}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});
 return setup(true);
}
