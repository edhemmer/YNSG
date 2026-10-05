import {NextResponse} from 'next/server';
import {z} from 'zod';
import {validGuardSignature} from '../../../../../lib/website-guard.js';
import {serverDatabase} from '../../../lib/google-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const input=z.object({key:z.uuid(),clientHash:digest,keyHash:digest,emailHash:digest,data:z.record(z.string(),z.union([z.string(),z.array(z.object({service:z.string(),task:z.string()}).strict())]))}).strict();
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>16000)return NextResponse.json({ok:false},{status:413,headers});
  const body=await request.text();if(Buffer.byteLength(body)>16000||!validGuardSignature(process.env.VERCEL_AUTOMATION_BYPASS_SECRET,body,request.headers.get('x-ynsg-guard-time'),request.headers.get('x-ynsg-guard-signature')))return NextResponse.json({ok:false},{status:401,headers});
  const parsed=input.safeParse(JSON.parse(body)),org=z.uuid().safeParse(process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID);
  if(!parsed.success||!org.success)return NextResponse.json({ok:false},{status:400,headers});
  const d=parsed.data,db=serverDatabase();
  const quota=await db.rpc('website_quota',{p_org:org.data,p_operation:'request',p_client:d.clientHash,p_key:d.keyHash,p_email:d.emailHash});
  if(quota.error||quota.data?.allowed!==true)return NextResponse.json({ok:false},{status:quota.error?503:429,headers});
  const result=await db.rpc('submit_service_request',{p_org:org.data,p_key:d.key,p_client_hash:d.clientHash,p_data:d.data});
  if(result.error){console.error('website_intake_failed',{category:['VALIDATION','SETUP_REQUIRED','RATE_LIMITED','IDEMPOTENCY_CONFLICT'].find(x=>result.error!.message.includes(x))||'UNAVAILABLE'});return NextResponse.json({ok:false},{status:result.error.message.includes('RATE_LIMITED')?429:503,headers});}
  if(result.data?.ok!==true||typeof result.data.id!=='string')return NextResponse.json({ok:false},{status:503,headers});
  return NextResponse.json({ok:true,id:result.data.id},{headers});
 }catch{return NextResponse.json({ok:false},{status:503,headers});}
}
