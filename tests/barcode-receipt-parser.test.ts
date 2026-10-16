import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProductBarcode,parseScannerCandidates,reconcileReceiptCapture} from '../apps/web/lib/barcode-receipt-parser.ts';

test('valid GTIN variants parse to canonical 14-digit identity',()=>{
 for(const code of ['96385074','012345678905','4006381333931','10012345678902']){
  const p=parseProductBarcode(code);
  assert.equal(p.gtin14.length,14);assert.equal(p.checkDigitValid,true);
 }
});
test('checksum spoofing, letter codes, and unsupported QR data are rejected',()=>{
 for(const code of ['012345678906','4006381333932','hello world','http://example.com','000000000000000','1234567',''])assert.throws(()=>parseProductBarcode(code));
});
test('camera results accept exactly one unique valid product identity',()=>{
 const good=parseScannerCandidates([{rawValue:'012345678905',format:'upc_a'},{rawValue:'00012345678905',format:'ean_13'}]);
 assert.equal(good.gtin14,'00012345678905');
 assert.throws(()=>parseScannerCandidates([{rawValue:'012345678905'},{rawValue:'4006381333931'}]),/AMBIGUOUS/);
 assert.throws(()=>parseScannerCandidates([{rawValue:'unsupported'}]),/NOT_FOUND/);
});
test('receipt lines reconcile purchase discount and tax without inventing prices',()=>{
 const v=reconcileReceiptCapture({merchant:'Example hardware store',purchaseDate:'2026-10-15',currency:'USD',source:'owner-entered',
  lines:[{productBarcode:'012345678905',description:'Caulk',quantity:1,subtotalCents:900,discountCents:100,taxPaidCents:60}],totalPaidCents:860});
 assert.equal(v.calculatedTotalCents,860);assert.equal(v.priceVerifiedByOwner,false);assert.equal(v.receiptImageStored,false);
 assert.throws(()=>reconcileReceiptCapture({...v,totalPaidCents:900}));
});
