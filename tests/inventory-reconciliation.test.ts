import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileDayWithRecordedStock} from '../apps/web/lib/inventory-reconciliation.ts';
import type {CombinedSupply} from '../apps/web/lib/day-supplies.ts';
const org='20000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000001';
const s=(name:string,quantity:number,unit='each',consumed=true):CombinedSupply=>({name,reason:'Owner approved',category:consumed?'consumable':'tool',requiresVerification:true,tasks:['Visit'],approved:{quantity,unit,consumed}});
const stock=(patch:Record<string,unknown>={})=>({id:'40000000-0000-4000-8000-000000000001',organizationId:org,name:'Caulk tubes',unit:'each',kind:'consumable',quantityOnHand:2,reorderAt:1,revision:1,recordedAt:'2026-10-15T12:00:00Z',...patch});
test('recorded available and shortages remain advisory, never physically verified',()=>{
 const result=reconcileDayWithRecordedStock(org,[s('Caulk tubes',1),s('Caulk tubes',4)],[stock()]);
 assert.equal(result[0]?.reason,'recorded-sufficient');
 assert.equal(result[0]?.shortage,0);
 assert.equal(result[1]?.reason,'recorded-shortage');
 assert.equal(result[1]?.shortage,2);
 assert.equal(result[0]?.physicallyVerified,false);
 assert.equal(result[0]?.reorderSuggested,true);
});
test('unquantified suggestions and unknown products do not become fabricated stock shortages',()=>{
 const unmatched=s('Wall anchor options',1),withQty=s('Caulk tubes',1),{approved:_unused,...unquantified}=withQty;
 const result=reconcileDayWithRecordedStock(org,[unmatched,unquantified],[stock()]);
 assert.equal(result[0]?.reason,'no-stock-record');assert.equal(result[0]?.shortage,null);
 assert.equal(result[1]?.reason,'unknown-quantity');assert.equal(result[1]?.shortage,null);
});
test('exact unit and consumable/reusable matches are required for valid counts',()=>{
 assert.equal(reconcileDayWithRecordedStock(org,[s('Caulk tubes',2,'boxes')],[stock()])[0]?.reason,'unit-mismatch');
 assert.equal(reconcileDayWithRecordedStock(org,[s('Caulk tubes',2,'each',false)],[stock()])[0]?.reason,'unit-mismatch');
});
test('tenant isolation, malformed counts and duplicate names fail closed',()=>{
 assert.throws(()=>reconcileDayWithRecordedStock(org,[s('Caulk tubes',1)],[stock({organizationId:other})]));
 assert.throws(()=>reconcileDayWithRecordedStock(org,[s('Caulk tubes',1)],[stock({quantityOnHand:-1})]));
 assert.throws(()=>reconcileDayWithRecordedStock(org,[s('Caulk tubes',1)],[stock(),stock({id:'50000000-0000-4000-8000-000000000001',name:' caulk tubes '})]));
});
