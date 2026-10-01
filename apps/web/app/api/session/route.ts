import {NextResponse} from 'next/server';import {cookies} from 'next/headers';import {z} from 'zod';
import {authClient,authenticated,sameOrigin,saveSession,failure} from '../../../lib/session';
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('send'),email:z.email().max(254)}),
 z.object({action:z.literal('verify'),email:z.email().max(254),code:z.string().regex(/^\d{6,10}$/)}),
 z.object({action:z.literal('refresh')}),z.object({action:z.literal('logout')})]);
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});
 try{
  const value=input.parse(await request.json());const db=authClient();
  if(value.action==='send'){
   const {error}=await db.auth.signInWithOtp({email:value.email,options:{shouldCreateUser:true}});
   if(error)return NextResponse.json({error:'Email sign-in is unavailable. Check workspace email setup or try again later.'},{status:503});
   return NextResponse.json({ok:true,message:'If email delivery is available for this account, enter the code from your email.'});
  }
  if(value.action==='verify'){
   const {data,error}=await db.auth.verifyOtp({email:value.email,token:value.code,type:'email'});
   if(error||!data.session)return NextResponse.json({error:'That code is invalid or expired. Request a new code.'},{status:400});
   return saveSession(NextResponse.json({ok:true}),data.session);
  }
  if(value.action==='refresh'){
   const refresh=(await cookies()).get('ynsg-refresh')?.value;if(!refresh)throw new Error('UNAUTHORIZED');
   const {data,error}=await db.auth.refreshSession({refresh_token:refresh});if(error||!data.session)throw new Error('UNAUTHORIZED');
   return saveSession(NextResponse.json({ok:true}),data.session);
  }
  const jar=await cookies();const access=jar.get('ynsg-access')?.value,refresh=jar.get('ynsg-refresh')?.value;
  if(access&&refresh){await db.auth.setSession({access_token:access,refresh_token:refresh});await db.auth.signOut({scope:'local'});}
  const response=NextResponse.json({ok:true});response.cookies.delete('ynsg-access');response.cookies.delete('ynsg-refresh');return response;
 }catch(error){return failure(error);}
}
export async function GET(){try{const {db,user}=await authenticated();const {data,error}=await db.from('memberships').select('organization_id,role').eq('user_id',user.id);if(error)throw error;return NextResponse.json({email:user.email,memberships:data},{headers:{'Cache-Control':'no-store'}});}catch(error){return failure(error);}}
