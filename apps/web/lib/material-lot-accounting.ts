import {z} from 'zod';
/** Pure accounting preview, not an inventory mutation or an issued invoice. */
const uuid=z.uuid();
const barcode=z.string().regex(/^[0-9]{8,14}$/);
export const materialPurchaseLot=z.object({
 id:uuid,organizationId:uuid,productBarcode:barcode.optional(),
 description:z.string().trim().min(2).max(200),
 purchasedUnits:z.number().int().min(1).max(100000),
 unitName:z.string().trim().min(1).max(40),
 pretaxCents:z.number().int().min(0).max(999999999),
 taxPaidCents:z.number().int().min(0).max(999999999),
 receiptId:uuid.nullable(),
 quantityRemaining:z.number().int().min(0).max(100000),
 returnStatus:z.enum(['none','pending','returned']),
}).strict().refine(v=>v.quantityRemaining<=v.purchasedUnits,{message:'Remaining units exceed purchase'});
export const materialUsage=z.object({
 organizationId:uuid,lotId:uuid,jobId:uuid,unitsUsed:z.number().int().positive().max(100000),
 treatment:z.enum(['included-in-labor','at-cost','customer-supplied']),
}).strict();
export type MaterialPurchaseLot=z.infer<typeof materialPurchaseLot>;
export type MaterialUsage=z.infer<typeof materialUsage>;
export function previewMaterialUse(rawLot:unknown,rawUsage:unknown){
 const lot=materialPurchaseLot.parse(rawLot),usage=materialUsage.parse(rawUsage);
 if(lot.organizationId!==usage.organizationId||lot.id!==usage.lotId)throw Error('MATERIAL_SCOPE_MISMATCH');
 if(lot.returnStatus!=='none')throw Error('MATERIAL_RETURN_PENDING');
 if(usage.unitsUsed>lot.quantityRemaining)throw Error('MATERIAL_STOCK_SHORTAGE');
 // Allocate tax already paid within source cost. Do not bill it as a new sales tax.
 const total=lot.pretaxCents+lot.taxPaidCents;
 if(!Number.isSafeInteger(total))throw Error('MATERIAL_COST_OVERFLOW');
 const before=lot.purchasedUnits-lot.quantityRemaining;
 const allocated=(n:number)=>Math.floor(total*n/lot.purchasedUnits);
 const costCents=allocated(before+usage.unitsUsed)-allocated(before);
 const billableCents=usage.treatment==='at-cost'?costCents:0;
 return {jobId:usage.jobId,lotId:lot.id,description:lot.description,unitsUsed:usage.unitsUsed,unitName:lot.unitName,
  recordedCostCents:costCents,billableCents,treatment:usage.treatment,receiptId:lot.receiptId,
  quantityRemainingAfter:lot.quantityRemaining-usage.unitsUsed,
  requiresDraftReview:true as const,issued:false as const};
}
export function shouldSuppressTinyConsumable(billableCents:number,thresholdCents:number){
 if(!Number.isInteger(billableCents)||billableCents<0||!Number.isInteger(thresholdCents)||thresholdCents<0)throw Error('INVALID_MATERIAL_THRESHOLD');
 return billableCents>0&&billableCents<thresholdCents;
}
