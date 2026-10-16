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
 const parsed=entries.map(mileageEntry.parse);
 const seen=new Set<string>();let miles=0;
 for(const trip of parsed){
  const key=trip.organizationId+':'+trip.id;
  if(seen.has(key))throw Error('DUPLICATE_TRIP');
  seen.add(key);
  if(trip.businessUse==='business')miles+=trip.odometerEnd-trip.odometerStart;
 }
 if(!Number.isSafeInteger(miles))throw Error('MILEAGE_OVERFLOW');
 return miles;
}
