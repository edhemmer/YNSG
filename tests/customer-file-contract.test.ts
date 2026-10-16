import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImageBytes,validCustomerFilePath,customerFileRecord,customerFileReservation} from '../apps/web/lib/customer-file-contract.ts';
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001';
test('private object identity is exactly scoped to customer organization and reserved UUID',()=>{
 assert.ok(validCustomerFilePath(org,id,org+'/'+id));
 for(const bad of ['../'+id,org+'/'+id+'/../another',org+'/other',id,'','A0000000-0000-4000-8000-000000000001/'+id])
  assert.equal(validCustomerFilePath(org,id,bad),false);
});
test('attachment binary signatures fail closed for spoofed mime, empty and truncated content',()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
 const jpeg=Uint8Array.from([255,216,255,224,12,34,56,78,255,217]);
 assert.equal(verifyImageBytes(png,'image/png'),true);
 assert.equal(verifyImageBytes(png,'image/jpeg'),false);
 assert.equal(verifyImageBytes(jpeg,'image/jpeg'),true);
 assert.equal(verifyImageBytes(jpeg,'image/png'),false);
 assert.equal(verifyImageBytes(jpeg.subarray(0,8),'image/jpeg'),false);
 assert.equal(verifyImageBytes(new Uint8Array(9),'application/pdf'),false);
 assert.equal(verifyImageBytes(new Uint8Array(8388609),'image/png'),false);
});
test('private listing contract rejects fabricated URLs and extra internal records',()=>{
 const row={id,name:'Synthetic receipt',purpose:'receipt',mime:'image/png',bytes:12,createdAt:'2026-10-16T19:00:00+00:00'};
 assert.equal(customerFileRecord.safeParse({...row,internalPath:'private/file'}).success,false);
 assert.equal(customerFileRecord.safeParse({...row,mime:'text/html'}).success,false);
 assert.equal(customerFileReservation.safeParse({id,path:org+'/'+id,ready:false}).success,true);
});
