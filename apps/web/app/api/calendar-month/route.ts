import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated, failure } from '../../../lib/session';
import { monthWindow } from '../../../lib/month-calendar';
type Appointment={id:string;request_id:string|null;status:string;start_at:string;end_at:string;arrival_at:string;expires_at:string|null};
type Submission={name:string;street:string;city:string;phone:string;service?:string;task?:string;services?:{service:string;task:string}[]};
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {
  const query=new URL(request.url).searchParams;
  const org=z.uuid().parse(query.get('organization'));
  const {db,user}=await authenticated();
  const membership=await db.from('memberships').select('role').eq('organization_id',org).eq('user_id',user.id).maybeSingle();
  if(membership.error||!['owner','admin'].includes(membership.data?.role||''))return NextResponse.json({error:'Owner access is required.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const company=await db.from('organizations').select('timezone').eq('id',org).single();
  if(company.error)throw company.error;
  const month=query.get('month')||'';
  const window=monthWindow(month,company.data.timezone);
  // Independent from workspace pagination. Never report a truncated month as complete.
  const appointments:Appointment[]=[];
  for(let page=0;page<7;page++) {
   const result=await db.from('appointments').select('id,request_id,status,start_at,end_at,arrival_at,expires_at').eq('organization_id',org).lt('start_at',window.end).gt('end_at',window.start).order('start_at').order('id').range(page*500,page*500+499);
   if(result.error)throw result.error;
   appointments.push(...result.data);
   if(appointments.length>3000)throw Error('MONTH_TOO_LARGE');
   if(result.data.length<500)break;
  }
  const requestIds=[...new Set(appointments.map(a=>a.request_id).filter((id):id is string=>id!==null))];
  const requests=new Map<string,Submission>();
  for(let i=0;i<requestIds.length;i+=200) {
   const result=await db.from('service_requests').select('id,original_submission').eq('organization_id',org).in('id',requestIds.slice(i,i+200));
   if(result.error)throw result.error;
   for(const row of result.data)requests.set(row.id,row.original_submission);
  }
  const blocks=await db.rpc('owner_calendar_blocks',{p_org:org});
  if(blocks.error)throw blocks.error;
  return NextResponse.json({month,timezone:company.data.timezone,checkedAt:new Date().toISOString(),appointments:appointments.map(a=>({...a,customer:a.request_id?requests.get(a.request_id)||null:null})),blocks:(blocks.data||[]).filter((b:{startsAt:string;endsAt:string})=>Date.parse(b.startsAt)<Date.parse(window.end)&&Date.parse(b.endsAt)>Date.parse(window.start))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
