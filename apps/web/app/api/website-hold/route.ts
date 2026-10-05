import {NextResponse} from 'next/server';
import {z} from 'zod';
import {guardDigest,validGuardSignature} from '../../../../../lib/website-guard.js';
import {hash} from '../../../lib/google-core';
import {serverDatabase} from '../../../lib/google-server';
import {websiteBookingFacts} from '../../../lib/website-booking';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const input=z.object({action:z.enum(['select','release']),key:z.uuid(),clientKey:z.uuid(),clientHash:z.string().regex(/^[a-f0-9]{64}$/),start:z.iso.datetime().nullable(),token:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict();
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>2000)return NextResponse.json({ok:false},{status:413,headers});
  const body=await request.text(),secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if(Buffer.byteLength(body)>2000||!validGuardSignature(secret,body,request.headers.get('x-ynsg-guard-time'),request.headers.get('x-ynsg-guard-signature')))return NextResponse.json({ok:false},{status:401,headers});
  const parsed=input.safeParse(JSON.parse(body)),org=z.uuid().safeParse(process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID);
  if(!parsed.success||!org.success||process.env.PUBLIC_AVAILABILITY_ENABLED!=='true')return NextResponse.json({ok:false},{status:400,headers});
  const d=parsed.data;
  if(d.action==='select'&&d.start===null)return NextResponse.json({ok:false},{status:400,headers});
  const db=serverDatabase(),token=d.action==='select'||!d.token?guardDigest(secret!,`slot:${org.data}:${d.clientKey}:${d.key}`):d.token;
  const quota=await db.rpc('website_quota',{p_org:org.data,p_operation:'availability',p_client:d.clientHash,p_key:guardDigest(secret!,'hold:'+d.key),p_email:null});
  if(quota.error||quota.data?.allowed!==true)return NextResponse.json({ok:false},{status:quota.error?503:429,headers});
  const result=await db.rpc('website_slot_hold',{p_org:org.data,p_action:d.action,p_key:d.key,p_client:d.clientHash,p_browser:guardDigest(secret!,'browser:'+d.clientKey),p_token:hash(token),p_start:d.start,p_provider:d.action==='select'?await websiteBookingFacts(org.data,d.start!):null});
  if(result.error)return NextResponse.json({ok:false},{status:result.error.message.includes('RATE_LIMITED')?429:['HOLD_EXPIRED','CAPACITY_CONFLICT','OWNER_BLOCK','GOOGLE_BUSY_CONFLICT','IDEMPOTENCY_CONFLICT','OUTSIDE_BOOKING_WINDOW','OUTSIDE_OPERATING_HOURS'].some(c=>result.error!.message.includes(c))?409:503,headers});
  if(result.data?.ok!==true)return NextResponse.json({ok:false},{status:503,headers});
  return NextResponse.json(d.action==='select'?{ok:true,token,start:result.data.start,end:result.data.end,expiresAt:result.data.expiresAt}:{ok:true},{headers});
 }catch{return NextResponse.json({ok:false},{status:503,headers});}
}
