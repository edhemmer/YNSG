import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {RADIUS_CENTER,PREFERRED_RADIUS_MILES,radiusAssessment} from '../../../lib/service-radius';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const params=z.object({organization:z.uuid(),request:z.uuid()});
export async function GET(request:Request){
 try{
  const {organization,request:requestId}=params.parse(Object.fromEntries(new URL(request.url).searchParams));
  const {db,user}=await authenticated();
  const member=await db.from('memberships').select('role').eq('organization_id',organization).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(member.error)throw Error('UNAVAILABLE');
  if(!member.data)return NextResponse.json({error:'Owner access required.'},{status:403,headers});
  const saved=await db.from('service_requests').select('original_submission').eq('organization_id',organization).eq('id',requestId).maybeSingle();
  if(saved.error)throw Error('UNAVAILABLE');
  if(!saved.data)return NextResponse.json({error:'Request not found.'},{status:404,headers});
  const a=saved.data.original_submission||{};
  const address=[a.street,a.city,a.state||a.region||'IL',a.postalCode||a.zip].filter(x=>typeof x==='string'&&x.trim()).join(', ');
  const base={center:RADIUS_CENTER.label,radiusMiles:PREFERRED_RADIUS_MILES,method:'straight_line',intakeAllowed:true,decision:'owner_only'};
  if(typeof a.street!=='string'||typeof a.city!=='string'||!a.street.trim()||!a.city.trim())return NextResponse.json({...base,status:'needs_review',miles:null},{headers});
  const url=new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
  url.searchParams.set('address',address);url.searchParams.set('benchmark','Public_AR_Current');url.searchParams.set('vintage','Current_Current');url.searchParams.set('format','json');
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(6000),cache:'no-store'});
   if(!response.ok)throw Error('GEOCODER');
   const data=await response.json();
   const matches=data?.result?.addressMatches;
   if(!Array.isArray(matches)||matches.length!==1)return NextResponse.json({...base,status:'needs_review',miles:null},{headers});
   const coordinate=matches[0]?.coordinates;
   const result=radiusAssessment(Number(coordinate?.y),Number(coordinate?.x));
   return NextResponse.json({...base,...result},{headers});
  }catch{return NextResponse.json({...base,status:'needs_review',miles:null},{headers});}
 }catch(e){return failure(e);}
}
