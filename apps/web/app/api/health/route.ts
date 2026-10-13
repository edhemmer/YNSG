import {NextResponse} from 'next/server';
import {serverDatabase} from '../../../lib/google-server';
import {mailAttentionKinds} from '../../../lib/notification-attention';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=10;
export async function GET(){
 try{
  const organization=process.env.GOOGLE_WORKER_ORGANIZATION_ID;
  if(!organization||process.env.GOOGLE_CALENDAR_WORKER_ENABLED!=='true')throw Error('NOT_READY');
  const {data,error}=await serverDatabase().rpc('operations_health',{p_org:organization,p_mail_kinds:mailAttentionKinds});
  if(error||data?.healthy!==true)throw Error('NOT_READY');
  return NextResponse.json({status:'ok',checkedAt:data.checkedAt},{headers:{'Cache-Control':'public, s-maxage=30, max-age=0'}});
 }catch{return NextResponse.json({status:'needs_attention'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
