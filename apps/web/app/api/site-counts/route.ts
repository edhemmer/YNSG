import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated} from '../../../lib/session';
import {siteCounts,notInstalled} from '../../../lib/call-leads-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
// Read-only anonymous website totals for the owner dashboard.
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,org=z.uuid().safeParse(q.get('organization')),days=z.coerce.number().int().min(1).max(365).safeParse(q.get('days')??'30');
 if(!org.success||!days.success)return NextResponse.json({error:'Choose a company and a date range.'},{status:400,headers});
 try{
  const {db}=await authenticated();const r=await db.rpc('owner_site_counts',{p_org:org.data,p_days:days.data});
  if(r.error){if(notInstalled(r.error.message))return NextResponse.json({installed:false},{headers});const code=r.error.message;return NextResponse.json({error:code==='FORBIDDEN'?'Owner access is required.':'Website counts could not be loaded. Try again.'},{status:code==='FORBIDDEN'?403:503,headers});}
  const value=siteCounts.safeParse(r.data);if(!value.success)return NextResponse.json({error:'Website counts could not be verified. Try again.'},{status:503,headers});
  return NextResponse.json({installed:true,...value.data},{headers});
 }catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':'Website counts could not be loaded. Try again.'},{status:code==='UNAUTHORIZED'?401:503,headers});}
}
