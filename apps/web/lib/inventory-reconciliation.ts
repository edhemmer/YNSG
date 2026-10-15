import {z} from 'zod';
import type {CombinedSupply} from './day-supplies.js';

const companyId=z.uuid();
export const stockRecord=z.object({
 id:z.uuid(),organizationId:companyId,
 name:z.string().trim().min(1).max(120),
 unit:z.string().trim().regex(/^[A-Za-z][A-Za-z ]{0,23}$/),
 kind:z.enum(['reusable','consumable']),
 quantityOnHand:z.number().int().min(0).max(100000),
 reorderAt:z.number().int().min(0).max(100000),
 revision:z.number().int().positive(),
 recordedAt:z.iso.datetime({offset:true}),
}).strict();
export type StockRecord=z.infer<typeof stockRecord>;
export type StockGap={name:string;needed:number|null;unit:string|null;recorded:number|null;shortage:number|null;reason:'recorded-sufficient'|'recorded-shortage'|'unit-mismatch'|'unknown-quantity'|'no-stock-record';reorderSuggested:boolean;physicallyVerified:false};
const clean=(v:string)=>v.trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
export function reconcileDayWithRecordedStock(company:string,supplies:CombinedSupply[],raw:unknown):StockGap[]{
 const organization=companyId.parse(company),records=z.array(stockRecord).max(10000).parse(raw);
 const map=new Map<string,StockRecord>();
 for(const x of records){
  if(x.organizationId!==organization)throw Error('CROSS_TENANT_STOCK');
  const k=clean(x.name);
  if(map.has(k))throw Error('DUPLICATE_STOCK_RECORD');
  map.set(k,x);
 }
 return supplies.map((s):StockGap=>{
  const needed=s.approved?.quantity??null,unit=s.approved?.unit??null,existing=map.get(clean(s.name));
  if(!existing)return {name:s.name,needed,unit,recorded:null,shortage:null,reason:'no-stock-record',reorderSuggested:false,physicallyVerified:false};
  if(needed===null||unit===null)return {name:s.name,needed:null,unit:null,recorded:existing.quantityOnHand,shortage:null,reason:'unknown-quantity',reorderSuggested:false,physicallyVerified:false};
  if(clean(existing.unit)!==clean(unit)||existing.kind!==(s.approved?.consumed?'consumable':'reusable'))
   return {name:s.name,needed,unit,recorded:existing.quantityOnHand,shortage:null,reason:'unit-mismatch',reorderSuggested:false,physicallyVerified:false};
  const shortage=Math.max(0,needed-existing.quantityOnHand);
  return {name:s.name,needed,unit,recorded:existing.quantityOnHand,shortage,reason:shortage>0?'recorded-shortage':'recorded-sufficient',reorderSuggested:existing.quantityOnHand-needed<existing.reorderAt,physicallyVerified:false};
 });
}
// Recorded inventory is advisory; actual packing/stock and store availability require owner verification.
// No quantities are purchased, reserved, depleted or invoiced by this pure function.
