import {test} from 'node:test';import assert from 'node:assert/strict';
import {previewInventoryMovement as move,inventoryLabel,parseInventoryScan,inventoryCsv} from '../apps/web/lib/inventory-custody';
const org='20000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',itemId='90000000-0000-4000-8000-000000000001',location='90000000-0000-4000-8000-000000000002',job='90000000-0000-4000-8000-000000000003',key='90000000-0000-4000-8000-000000000004';
const item={id:itemId,organization:org,revision:1,name:'Synthetic drill',kind:'asset',quantity:1,unit:'each',location,custodian:null,status:'available',productBarcode:null,purchaseUnitCents:12999,replacementCents:null,updatedAt:'2026-11-01T12:00:00Z'};
const scope={organization:org,actor,office:true,at:'2026-11-01T13:00:00Z',locations:[location],people:[actor,other],jobs:[job]};
const command={organization:org,item:itemId,key,revision:1,reason:'Synthetic physical handoff'};
test('asset handoff preserves who, where, time and prior record; other tech cannot return it',()=>{
 const result=move(item,{...command,action:'checkout',custodian:actor,location},scope);
 assert.equal(result.item.custodian,actor);assert.deepEqual(result.event.before,item);assert.equal(item.revision,1);assert.equal(result.persisted,false);
 assert.throws(()=>move(result.item,{...command,revision:2,action:'return',location},{...scope,actor:other,office:false}),/FORBIDDEN/);
 const returned=move(result.item,{...command,revision:2,action:'return',location},{...scope,office:false});assert.equal(returned.item.custodian,null);assert.equal(returned.item.status,'available');
});
test('stale, cross-company, unknown-person/location and reversed-time moves fail',()=>{
 for(const [c,s,pattern] of [[{...command,revision:2,action:'checkout',custodian:actor,location},scope,/STALE/],[{...command,organization:other,action:'move',location},scope,/SCOPE/],[{...command,action:'checkout',custodian:job,location},scope,/PERSON/],[{...command,action:'move',location:job},scope,/LOCATION/],[{...command,action:'move',location},{...scope,at:'2026-11-01T11:00:00Z'},/TIME/]] as const)assert.throws(()=>move(item,c,s),pattern);
});
test('consumption requires a known job and sufficient quantity, without changing price or invoice',()=>{
 const stock={...item,kind:'consumable',quantity:5};const used=move(stock,{...command,action:'consume',units:2,job},scope);assert.equal(used.item.quantity,3);assert.equal(used.item.purchaseUnitCents,12999);assert.equal(used.invoiceUpdated,false);
 assert.throws(()=>move(stock,{...command,action:'consume',units:6,job},scope),/SHORTAGE/);assert.throws(()=>move(stock,{...command,action:'consume',units:1,job:actor},scope),/JOB/);
 assert.throws(()=>move(item,{...command,action:'consume',units:1,job},scope),/NOT_CONSUMABLE/);
 assert.throws(()=>move({...item,status:'retired'},{...command,action:'move',location},scope),/RETIRED/);
});
test('scans distinguish an individual item from a shared UPC and never open arbitrary URLs',()=>{
 assert.deepEqual(parseInventoryScan(inventoryLabel(itemId)+'\r\n'),{kind:'company-item',id:itemId});assert.deepEqual(parseInventoryScan('036000291452'),{kind:'product',gtin14:'00036000291452'});
 for(const bad of ['https://example.invalid/item','YNSG-A:not-an-id','036000291453'])assert.throws(()=>parseInventoryScan(bad));
});
test('export keeps unknown cost blank, escapes spreadsheet formulas and rejects mixed companies',()=>{
 const csv=inventoryCsv(org,[{...item,name:'=HYPERLINK("example")',purchaseUnitCents:null}]);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/,"","","2026-11/);assert.throws(()=>inventoryCsv(org,[item,{...item,id:job,organization:other}]),/SCOPE/);assert.throws(()=>inventoryCsv(org,[item,item]),/DUPLICATE/);
});
