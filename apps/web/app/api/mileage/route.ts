import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {mileageEntry,verifiedMileageReceipt} from '../../../lib/mileage-contract';
const headers={'Cache-Control':'private, no-store'};
const uuid=z.uuid();
const query=z.object({organization:uuid,from:z.iso.date(),to:z.iso.date(),page:z.coerce.number().int().min(0).max(10000)}).strict();
const record=z.object({action:z.literal('record'),key:uuid,entry:mileageEntry}).strict();
const reverse=z.object({action:z.literal('reverse'),organization:uuid,id:uuid,key:uuid,reason:z.string().trim().min(10).max(300)}).strict();
const command=z.union([record,reverse]);
const receipt=z.union([z.object({id:uuid,miles:z.number().int(),businessMiles:z.number().int(),reversed:z.boolean()}).strict(),z.object({id:uuid,reversed:z.literal(true)}).strict()]);
const result=z.object({from:z.iso.date(),to:z.iso.date(),page:z.number().int(),businessMiles:z.number().int().min(0),activeTrips:z.number().int().min(0),trips:z.array(z.object({
 id:uuid,trip_date:z.iso.date(),purpose:z.string(),origin:z.string(),destination:z.string(),vehicle_label:z.string(),odometer_start:z.number().int(),odometer_end:z.number().int(),
 business_use:z.enum(['business','personal','mixed-review']),recorded_source:z.enum(['manual-odometer','verified-trip-log']),job_id:uuid.nullable(),notes:z.string(),created_at:z.iso.datetime({offset:true}),reversed_at:z.iso.datetime({offset:true}).nullable(),reversal_reason:z.string().nullable()
}).strict()).max(51)}).strict();
const errorText='The mileage result could not be confirmed. Check the saved trips before recording another change.';
export async function GET(request:Request){
 const url=new URL(request.url),p=query.safeParse({organization:url.searchParams.get('organization'),from:url.searchParams.get('from'),to:url.searchParams.get('to'),page:url.searchParams.get('page')||0});
 if(!p.success)return NextResponse.json({error:'Choose a valid mileage date range.'},{status:400,headers});
 try{
  const {db}=await authenticated(),v=p.data;
  const r=await db.rpc('mileage_activity',{p_org:v.organization,p_from:v.from,p_to:v.to,p_page:v.page});
  if(r.error)return NextResponse.json({error:r.error.code==='42501'?'Mileage access is not permitted.':errorText},{status:r.error.code==='42501'?403:503,headers});
  const parsed=result.safeParse(r.data);
  if(!parsed.success||parsed.data.page!==v.page||parsed.data.from!==v.from||parsed.data.to!==v.to)return NextResponse.json({error:errorText},{status:503,headers});
  return NextResponse.json({...parsed.data,trips:parsed.data.trips.slice(0,50),hasMore:parsed.data.trips.length>50},{headers});
 }catch(e){return failure(e)}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();
  if(Buffer.byteLength(raw)>6000)return NextResponse.json({error:'Mileage entry is too long.'},{status:413,headers});
  const parsed=command.safeParse(JSON.parse(raw));
  if(!parsed.success)return NextResponse.json({error:'Review the trip readings, addresses and purpose.'},{status:400,headers});
  const {db}=await authenticated(),v=parsed.data;
  const r=v.action==='record'?await db.rpc('record_mileage_trip',{
   p_org:v.entry.organizationId,p_id:v.entry.id,p_key:v.key,p_date:v.entry.tripDate,
   p_purpose:v.entry.purpose,p_origin:v.entry.origin,p_destination:v.entry.destination,p_vehicle:v.entry.vehicleLabel,
   p_start:v.entry.odometerStart,p_end:v.entry.odometerEnd,p_usage:v.entry.businessUse,p_source:v.entry.recordedSource,p_job:v.entry.jobId,p_notes:v.entry.notes
  }):await db.rpc('reverse_mileage_trip',{p_org:v.organization,p_id:v.id,p_key:v.key,p_reason:v.reason});
  if(r.error)return NextResponse.json({error:r.error.code==='42501'?'You cannot change mileage for that company.':r.error.message==='OVERLAPPING_MILEAGE'?'These odometer readings overlap a saved business trip. Review the trip list.':errorText},{status:r.error.code==='42501'?403:r.error.message==='OVERLAPPING_MILEAGE'?409:503,headers});
  const response=receipt.safeParse(r.data);
  if(!response.success||response.data.id!==(v.action==='record'?v.entry.id:v.id))return NextResponse.json({error:errorText},{status:503,headers});
  try{verifiedMileageReceipt({result:response.data},raw);}catch{return NextResponse.json({error:errorText},{status:503,headers});}
  return NextResponse.json({result:response.data},{headers});
 }catch(e){return failure(e)}
}
