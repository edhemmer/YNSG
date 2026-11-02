import {z} from 'zod';
import {parseProductBarcode} from './barcode-receipt-parser';

const id=z.uuid(),cents=z.number().int().min(0).max(999999999);
const state=z.enum(['available','checked_out','maintenance','missing','retired']);
export const inventoryItem=z.object({
 id,organization:id,revision:z.number().int().positive(),name:z.string().trim().min(2).max(160),
 kind:z.enum(['asset','consumable']),quantity:z.number().int().min(0).max(100000),unit:z.string().trim().min(1).max(30),
 location:id,custodian:id.nullable(),status:state,productBarcode:z.string().nullable(),
 purchaseUnitCents:cents.nullable(),replacementCents:cents.nullable(),updatedAt:z.iso.datetime({offset:true}),
}).strict().superRefine((v,c)=>{
 if(v.kind==='asset'&&v.quantity!==1)c.addIssue({code:'custom',message:'An individual asset has one identity'});
 if((v.status==='checked_out')!==(v.custodian!==null))c.addIssue({code:'custom',message:'Only checked-out items have custody'});
 if(v.productBarcode!==null)try{parseProductBarcode(v.productBarcode)}catch{c.addIssue({code:'custom',message:'Invalid product barcode'})}
});
const base=z.object({organization:id,item:id,key:id,revision:z.number().int().positive(),reason:z.string().trim().min(2).max(500)}).strict();
export const inventoryMovement=z.discriminatedUnion('action',[
 base.extend({action:z.literal('move'),location:id}),
 base.extend({action:z.literal('checkout'),location:id,custodian:id}),
 base.extend({action:z.literal('return'),location:id}),
 base.extend({action:z.literal('consume'),units:z.number().int().positive().max(100000),job:id}),
 base.extend({action:z.literal('count'),quantity:z.number().int().min(0).max(100000)}),
 base.extend({action:z.literal('status'),status:state.exclude(['checked_out'])}),
 base.extend({action:z.literal('cost'),purchaseUnitCents:cents.nullable(),replacementCents:cents.nullable()}),
]);
// A future server adapter must obtain this scope from current database authorization,
// never from a browser-supplied role, and persist state/event/idempotency atomically.
const scope=z.object({organization:id,actor:id,office:z.boolean(),at:z.iso.datetime({offset:true}),locations:z.array(id).max(1000),people:z.array(id).max(1000),jobs:z.array(id).max(1000)}).strict();
export function previewInventoryMovement(rawItem:unknown,rawCommand:unknown,rawScope:unknown){
 const before=inventoryItem.parse(rawItem),command=inventoryMovement.parse(rawCommand),access=scope.parse(rawScope);
 if(before.organization!==access.organization||command.organization!==access.organization||before.id!==command.item)throw Error('INVENTORY_SCOPE_MISMATCH');
 if(before.revision!==command.revision)throw Error('STALE_INVENTORY_REVISION');
 if(Date.parse(access.at)<Date.parse(before.updatedAt))throw Error('INVENTORY_TIME_REVERSED');
 if(!access.office&&(!(command.action==='return'||command.action==='consume')||before.custodian!==access.actor))throw Error('INVENTORY_FORBIDDEN');
 if(before.status==='retired')throw Error('INVENTORY_RETIRED');
 const next={...before,revision:before.revision+1,updatedAt:access.at};
 if('location' in command){if(!access.locations.includes(command.location))throw Error('INVENTORY_LOCATION_UNKNOWN');next.location=command.location}
 switch(command.action){
  case 'move':if(before.status!=='available')throw Error('INVENTORY_NOT_AVAILABLE');break;
  case 'checkout':
   if(before.status!=='available'||before.quantity===0)throw Error('INVENTORY_NOT_AVAILABLE');
   if(!access.people.includes(command.custodian))throw Error('INVENTORY_PERSON_UNKNOWN');
   next.status='checked_out';next.custodian=command.custodian;break;
  case 'return':if(before.status!=='checked_out')throw Error('INVENTORY_NOT_CHECKED_OUT');next.status='available';next.custodian=null;break;
  case 'consume':
   if(before.kind!=='consumable'||!['available','checked_out'].includes(before.status))throw Error('INVENTORY_NOT_CONSUMABLE');
   if(!access.jobs.includes(command.job))throw Error('INVENTORY_JOB_UNKNOWN');
   if(command.units>before.quantity)throw Error('INVENTORY_SHORTAGE');next.quantity-=command.units;break;
  case 'count':if(before.kind!=='consumable')throw Error('INVENTORY_ASSET_COUNT');next.quantity=command.quantity;break;
  case 'status':next.status=command.status;next.custodian=null;break;
  case 'cost':next.purchaseUnitCents=command.purchaseUnitCents;next.replacementCents=command.replacementCents;break;
 }
 return {item:inventoryItem.parse(next),event:{key:command.key,organization:access.organization,item:before.id,actor:access.actor,at:access.at,action:command.action,reason:command.reason,priorRevision:before.revision,revision:next.revision,before,after:next,job:command.action==='consume'?command.job:null},persisted:false as const,invoiceUpdated:false as const};
}
export function inventoryLabel(itemId:string){return 'YNSG-A:'+id.parse(itemId)}
export function parseInventoryScan(raw:unknown){
 const value=z.string().trim().min(1).max(100).parse(raw);
 if(value.startsWith('YNSG-A:'))return {kind:'company-item' as const,id:id.parse(value.slice(7))};
 return {kind:'product' as const,gtin14:parseProductBarcode(value).gtin14};
}
export function inventoryCsv(organization:string,raw:unknown){
 const company=id.parse(organization),items=z.array(inventoryItem).max(10000).parse(raw),ids=new Set<string>();
 for(const item of items){if(item.organization!==company)throw Error('INVENTORY_SCOPE_MISMATCH');if(ids.has(item.id))throw Error('INVENTORY_DUPLICATE_ITEM');ids.add(item.id)}
 const cell=(raw:string|number|null)=>{let value=String(raw??'');if(/^[\s\uFEFF]*[=+@-]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"'};
 return '\uFEFF'+[['Item ID','Label','Name','Kind','Quantity','Unit','Location ID','Custodian ID','Status','Product barcode','Recorded purchase unit cents','Replacement cents','Updated UTC','Revision'],...items.map(i=>[i.id,inventoryLabel(i.id),i.name,i.kind,i.quantity,i.unit,i.location,i.custodian,i.status,i.productBarcode,i.purchaseUnitCents,i.replacementCents,i.updatedAt,i.revision])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
