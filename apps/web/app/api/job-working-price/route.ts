import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
const headers={'Cache-Control':'private, no-store'};
const price=z.object({cents:z.number().int().min(0).max(999999999),note:z.string().max(500)}).strict();
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams;const {db}=await authenticated();
  const r=await db.rpc('job_working_price',{p_org:z.uuid().parse(q.get('organization')),p_job:z.uuid().parse(q.get('job'))});
  if(r.error)throw r.error;
  return NextResponse.json({price:r.data?price.parse(r.data):null},{headers});
 }catch(e){return failure(e)}
}
const input=z.object({organization:z.uuid(),job:z.uuid(),cents:z.number().int().min(0).max(999999999),note:z.string().max(500)}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>2000)throw Error('VALIDATION');
  const v=input.parse(JSON.parse(raw));const {db}=await authenticated();
  const r=await db.rpc('set_job_working_price',{p_org:v.organization,p_job:v.job,p_cents:v.cents,p_note:v.note});
  if(r.error){
   if(r.error.code==='42501')return NextResponse.json({error:'Your account cannot change this price.'},{status:403,headers});
   if(r.error.message==='TRANSITION')return NextResponse.json({error:'This job is already invoiced.'},{status:409,headers});
   throw r.error;
  }
  return NextResponse.json({price:price.parse(r.data)},{headers});
 }catch(e){
  if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'Enter a valid amount.'},{status:400,headers});
  return failure(e);
 }
}
