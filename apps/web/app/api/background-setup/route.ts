import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authorizeGoogle,serverDatabase} from '../../../lib/google-server';
import {sameOrigin} from '../../../lib/session';
import {backgroundDeployment,verifiedSessionId} from '../../../lib/background-setup';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!sameOrigin(request))return NextResponse.json({error:'Open Settings in your business app to continue.'},{status:403,headers});
 try{
  const input=z.object({organization:z.uuid(),rotationConfirmed:z.literal(true)}).strict().parse(await request.json());
  const session=await authorizeGoogle(input.organization);
  const {worker,bypass,origin}=backgroundDeployment(process.env,input.organization);
  const {data,error}=await serverDatabase().rpc('background_setup',{p_org:input.organization,p_actor:session.user.id,p_session:verifiedSessionId(session.access),p_action:'prepare',p_worker:worker,p_bypass:bypass,p_origin:origin});
  if(error)throw Error('SETUP_REQUIRED');
  return NextResponse.json({status:data,message:'Credentials stored securely. Background jobs are paused until live verification passes.'},{headers});
 }catch(error){return NextResponse.json({error:'Background setup could not be completed. Confirm your owner sign-in, regenerate the Vercel automation key, and redeploy the app branch before trying again.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:400,headers});}
}
