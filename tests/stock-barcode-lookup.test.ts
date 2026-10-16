import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupPurchasedItem} from '../apps/web/lib/stock-barcode-lookup.ts';

const organizationId='20000000-0000-4000-8000-000000000001',other='70000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',receipt='50000000-0000-4000-8000-000000000001';
const product={organizationId,barcode:'012345678905',name:'Paintable white caulk',packageSize:'10.1 fl oz tube',itemUnit:'tube'};
const lot={id,organizationId,productBarcode:'012345678905',description:product.name,purchasedUnits:100,unitName:'percent of tube',pretaxCents:740,taxPaidCents:60,receiptId:receipt,quantityRemaining:50,returnStatus:'none'};
const request={organizationId,barcode:'012345678905'};
test('scan returns product, unit size, paid cost, tax, receipt pointer and remaining stock',()=>{
 const value=lookupPurchasedItem(request,[product],[lot]);
 assert.equal(value.name,'Paintable white caulk');
 assert.equal(value.packageSize,'10.1 fl oz tube');
 assert.equal(value.lots[0]?.totalPaidCents,800);
 assert.equal(value.lots[0]?.receiptId,receipt);
 assert.equal(value.lots[0]?.quantityRemaining,50);
 assert.equal(value.needsLotSelection,false);
 assert.equal(value.invoiceUpdated,false);
});
test('two purchases of same barcode retain distinct costs and receipts without guessing lot',()=>{
 const value=lookupPurchasedItem(request,[product],[lot,{...lot,id:'40000000-0000-4000-8000-000000000001',pretaxCents:950,receiptId:'60000000-0000-4000-8000-000000000001'}]);
 assert.equal(value.needsLotSelection,true);
 assert.equal(value.lots.length,2);
 assert.equal(value.lots[1]?.totalPaidCents,1010);
});
test('missing recorded purchase cannot fabricate an actual price',()=>{
 const v=lookupPurchasedItem(request,[product],[]);
 assert.equal(v.foundInInventory,false);assert.equal(v.needsLotSelection,true);assert.equal(v.lots.length,0);
 assert.equal(v.priceSource,null);assert.equal(v.receiptSource,null);
});
test('cross-tenant receipt/lot exposure is blocked before lookup',()=>{
 assert.throws(()=>lookupPurchasedItem(request,[product],[{...lot,organizationId:other}]),/CROSS_TENANT/);
 assert.throws(()=>lookupPurchasedItem(request,[{...product,organizationId:other}],[lot]),/CROSS_TENANT/);
});
test('returned and exhausted purchases are not available for a new material use',()=>{
 const result=lookupPurchasedItem(request,[product],[{...lot,returnStatus:'returned'},{...lot,id:'40000000-0000-4000-8000-000000000001',quantityRemaining:0}]);
 assert.equal(result.lots.length,0);
});

test('purchase without an attached receipt never advertises receipt evidence',()=>{
 const v=lookupPurchasedItem(request,[product],[{...lot,receiptId:null}]);
 assert.equal(v.priceSource,'recorded-purchase');
 assert.equal(v.receiptSource,null);
});
