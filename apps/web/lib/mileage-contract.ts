import {z} from 'zod';

const uuid=z.uuid();
const odometer=z.number().int().min(0).max(9999999);
export const mileageEntry=z.object({
 organizationId:uuid,id:uuid,tripDate:z.iso.date(),
 purpose:z.string().trim().min(5).max(300),
 origin:z.string().trim().min(3).max(250),
 destination:z.string().trim().min(3).max(250),
 vehicleLabel:z.string().trim().min(2).max(100),
 odometerStart:odometer,odometerEnd:odometer,
 businessUse:z.enum(['business','personal','mixed-review']),
 recordedSource:z.enum(['manual-odometer','verified-trip-log']),
 jobId:uuid.nullable(),
 notes:z.string().trim().max(500),
}).strict().superRefine((v,ctx)=>{
 if(v.odometerEnd<=v.odometerStart)ctx.addIssue({code:'custom',path:['odometerEnd'],message:'The ending reading must exceed the start.'});
 if(v.origin.toLowerCase()===v.destination.toLowerCase())ctx.addIssue({code:'custom',path:['destination'],message:'Describe the actual route or stops.'});
});
export type MileageEntry=z.infer<typeof mileageEntry>;
export function previewMileage(raw:unknown){
 const v=mileageEntry.parse(raw),miles=v.odometerEnd-v.odometerStart;
 return {entryId:v.id,organizationId:v.organizationId,miles,
  businessMiles:v.businessUse==='business'?miles:0,
  requiresClassificationReview:v.businessUse==='mixed-review',
  // Recorded mileage is not automatically deductible; client must not infer IRS treatment.
  deductionCents:null as null,invoiceChargeCents:null as null,
  recordedSource:v.recordedSource,jobId:v.jobId};
}
export function sumConfirmedBusinessMiles(entries:unknown[]){
 const parsed=entries.map(entry=>mileageEntry.parse(entry));
 const seen=new Set<string>();const businessTrips: MileageEntry[]=[];let miles=0;
 for(const trip of parsed){
  const key=trip.organizationId+':'+trip.id;
  if(seen.has(key))throw Error('DUPLICATE_TRIP');
  seen.add(key);
  if(trip.businessUse==='business'){
   // Flag potentially double-counted odometer intervals; do not silently inflate totals.
   const conflict=businessTrips.some(other=>other.organizationId===trip.organizationId &&
    other.tripDate===trip.tripDate && other.vehicleLabel.trim().toLowerCase()===trip.vehicleLabel.trim().toLowerCase() &&
    trip.odometerStart<other.odometerEnd && other.odometerStart<trip.odometerEnd);
   if(conflict)throw Error('OVERLAPPING_BUSINESS_MILEAGE');
   businessTrips.push(trip);
   miles+=trip.odometerEnd-trip.odometerStart;
  }
 }
 if(!Number.isSafeInteger(miles))throw Error('MILEAGE_OVERFLOW');
 return miles;
}


export const mileageTrip=z.object({
 id:uuid,trip_date:z.iso.date(),purpose:z.string(),origin:z.string(),destination:z.string(),vehicle_label:z.string(),
 odometer_start:odometer,odometer_end:odometer,business_use:z.enum(['business','personal','mixed-review']),
 recorded_source:z.enum(['manual-odometer','verified-trip-log']),job_id:uuid.nullable(),notes:z.string(),
 created_at:z.iso.datetime({offset:true}),reversed_at:z.iso.datetime({offset:true}).nullable(),reversal_reason:z.string().nullable()
}).strict().refine(v=>v.odometer_end>v.odometer_start);
export const mileageReport=z.object({from:z.iso.date(),to:z.iso.date(),page:z.number().int().min(0),businessMiles:z.number().int().min(0),activeTrips:z.number().int().min(0),trips:z.array(mileageTrip).max(50),hasMore:z.boolean()}).strict();
export function verifiedMileageReceipt(raw:unknown,body:string){
 const command=JSON.parse(body),result=(raw as {result?:unknown})?.result;
 if(command.action==='record'){
  const entry=mileageEntry.parse(command.entry),receipt=z.object({id:uuid,miles:z.number().int().positive(),businessMiles:z.number().int().min(0),reversed:z.literal(false)}).strict().parse(result);
  const miles=entry.odometerEnd-entry.odometerStart;
  if(receipt.id!==entry.id||receipt.miles!==miles||receipt.businessMiles!==(entry.businessUse==='business'?miles:0))throw Error('UNCONFIRMED_MILEAGE');
  return receipt;
 }
 const receipt=z.object({id:uuid,reversed:z.literal(true)}).strict().parse(result);
 if(command.action!=='reverse'||receipt.id!==command.id)throw Error('UNCONFIRMED_MILEAGE');
 return receipt;
}
