import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceChargeCents} from '../apps/web/lib/invoice-charge.ts';
test('invoice charges preserve exact cents including zero-charge work',()=>{
 for(const [amount,cents] of [['0',0],['0.00',0],['0.01',1],['45.10',4510],['120',12000],['1.1',110],['9999999.99',999999999]] as const)assert.equal(invoiceChargeCents(amount),cents);
});
test('invalid charges cannot become rounded or fabricated invoice cents',()=>{
 for(const amount of ['','1.005','0.009','-1','NaN','Infinity','1e3','1,000',' 1 ','10000000','1.','0.001'])assert.equal(invoiceChargeCents(amount),null,amount);
});
