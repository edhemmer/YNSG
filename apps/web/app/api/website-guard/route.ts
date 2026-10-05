import {NextResponse} from 'next/server';
import {z} from 'zod';
import {validGuardSignature} from '../../../../../lib/website-guard.js';
import {serverDatabase} from '../../../lib/google-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const input=z.object({operation:z.enum(['availability','request']),clientHash:z.string().regex(/^[a-f0-9]{64}$/),keyHash:z.string().regex(/^[a-f0-9]{64}$/),emailHash:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict();
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>1024)return NextResponse.json({allowed:false},{status:413,headers});
  const body=await request.text();if(Buffer.byteLength(body)>1024||!validGuardSignature(process.env.VERCEL_AUTOMATION_BYPASS_SECRET,body,request.headers.get('x-ynsg-guard-time'),request.headers.get('x-ynsg-guard-signature')))return NextResponse.json({allowed:false},{status:401,headers});
  const parsed=input.safeParse(JSON.parse(body)),org=z.uuid().safeParse(process.env.PUBLIC_SCHEDULING_ORGANIZATION_ID);
  if(!parsed.success||!org.success)return NextResponse.json({allowed:false},{status:400,headers});
  const d=parsed.data;if(d.operation==='request'&&!d.emailHash)return NextResponse.json({allowed:false},{status:400,headers});
  const result=await serverDatabase().rpc('website_quota',{p_org:org.data,p_operation:d.operation,p_client:d.clientHash,p_key:d.keyHash,p_email:d.emailHash});
  if(result.error)return NextResponse.json({allowed:false},{status:503,headers});
  return NextResponse.json({allowed:result.data.allowed===true},{status:result.data.allowed===true?200:429,headers:{...headers,...(result.data.allowed===true?{}:{'Retry-After':String(result.data.retryAfter||60)})}});
 }catch{return NextResponse.json({allowed:false},{status:503,headers});}
}
