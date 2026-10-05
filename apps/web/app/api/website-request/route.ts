import {NextResponse} from 'next/server';
import {z} from 'zod';
import {guardDigest,validGuardSignature} from '../../../../../lib/website-guard.js';
import {serverDatabase} from '../../../lib/google-server';
import {hash} from '../../../lib/google-core';
import {websiteSelection,websiteBookingFacts} from '../../../lib/website-booking';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const input=z.object({key:z.uuid(),clientHash:digest,keyHash:digest,emailHash:digest,data:z.record(z.string(),z.union([z.string(),z.array(z.object({service:z.string(),task:z.string()}).strict())])),selection:websiteSelection.nullable().optional()}).strict();
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>16000)return NextResponse.json({ok:false},{status:413,headers});
  const body=await request.text();if(Buffer.byteLength(body)>16000||!validGuardSignature(process.env.VERCEL_AUTOMATION_BYPASS_SECRET,body,request.headers.get('x-ynsg-guard-time'),request.headers.get('x-ynsg-guard-signature')))return NextResponse.json({ok:false},{status:401,headers});
  const parsed=input.safeParse(JSON.parse(body)),org=z.uuid().safeParse(process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID);
  if(!parsed.success||!org.success)return NextResponse.json({ok:false},{status:400,headers});
  const d=parsed.data,db=serverDatabase();
  const quota=await db.rpc('website_quota',{p_org:org.data,p_operation:'request',p_client:d.clientHash,p_key:d.keyHash,p_email:d.emailHash});
  if(quota.error||quota.data?.allowed!==true)return NextResponse.json({ok:false},{status:quota.error?503:429,headers});
  const selection=d.selection?{mode:d.selection.mode,start:d.selection.start,tokenHash:hash(d.selection.token),browserHash:guardDigest(process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,'browser:'+d.selection.clientKey)}:null;
  const args={p_org:org.data,p_key:d.key,p_client_hash:d.clientHash,p_data:d.data,p_selection:selection,p_provider:null as unknown};
  // Return a committed receipt before consulting Google again. Retries must not
  // fail just because their own reservation is now visible or the provider is down.
  let result=await db.rpc('submit_website_request',args);
  if(!result.error&&!result.data&&d.selection)result=await db.rpc('submit_website_request',{...args,p_provider:await websiteBookingFacts(org.data,d.selection.start)});
  if(result.error){console.error('website_intake_failed',{category:['HOLD_EXPIRED','GOOGLE_BUSY_CONFLICT','VALIDATION','SETUP_REQUIRED','RATE_LIMITED','IDEMPOTENCY_CONFLICT'].find(x=>result.error!.message.includes(x))||'UNAVAILABLE'});return NextResponse.json({ok:false},{status:result.error.message.includes('RATE_LIMITED')?429:['HOLD_EXPIRED','GOOGLE_BUSY_CONFLICT'].some(c=>result.error!.message.includes(c))?409:503,headers});}
  if(result.data?.ok!==true||typeof result.data.id!=='string')return NextResponse.json({ok:false},{status:503,headers});
  return NextResponse.json({ok:true,id:result.data.id},{headers});
 }catch{return NextResponse.json({ok:false},{status:503,headers});}
}
