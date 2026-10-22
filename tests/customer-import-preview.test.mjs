import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('customer import preview is explicitly non-mutating and tenant authorized',()=>{
 const route=readFileSync('apps/web/app/api/customer-import-preview/route.ts','utf8');
 assert.match(route,/sameOrigin\(request\)/);
 assert.match(route,/document\.organization!==organization\|\|document\.customer\.id!==customer/);
 assert.match(route,/owner_customer_records/);
 assert.doesNotMatch(route,/manage_customer_record|\.insert\(|\.update\(|\.delete\(/);
 assert.match(route,/previewOnly:true/);
 assert.match(route,/writeCount:0/);
 assert.match(route,/duplicate_in_file/);
});
test('customer import preview available only within selected owner customer record',()=>{
 const owner=readFileSync('apps/web/app/customer-records.tsx','utf8'),ui=readFileSync('apps/web/app/customer-import-preview.tsx','utf8');
 assert.match(owner,/<CustomerImportPreview key=\{'import:'\+organization\+':'\+detail\.customer\.id\} organization=\{organization\} customer=\{detail\.customer\.id\}\/>/);
 assert.match(ui,/data\?\.writeCount!==0/);
 assert.match(ui,/nothing imported/i);
});
