import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('customer portability route refuses incomplete or unstable paginated snapshots',()=>{
 const code=readFileSync('apps/web/app/api/customer-export/route.ts','utf8');
 assert.match(code,/customerDetail\.safeParse\(r\.data\)/);
 assert.match(code,/if\(page>250\)throw Error\('EXPORT_TOO_LARGE'\)/);
 assert.match(code,/if\(requestsMore&&current\.requests\.length===0\)throw Error\('UNVERIFIED'\)/);
 assert.match(code,/if\(historyMore&&current\.history\.length===0\)throw Error\('UNVERIFIED'\)/);
 assert.match(code,/if\(current\.customer\.revision!==initial\.customer\.revision/);
 assert.match(code,/if\(seenRequests\.has\(item\.id\)\)throw Error\('CHANGED'\)/);
 assert.match(code,/if\(seenHistory\.has\(item\.id\)\)throw Error\('CHANGED'\)/);
 assert.match(code,/const latest=await pages\(0,0\)/);
 assert.match(code,/contacts:latest\.contacts,properties:latest\.properties/);
 assert.doesNotMatch(code,/service_role|createSignedUrl|download.*storage/i);
 assert.match(code,/db.rpc\('audit_customer_export'/);
 assert.match(code,/if\(audit.error\|\|!proof.success/);
});
test('customer export UI requires complete scope and exact organization/customer receipt',()=>{
 const ui=readFileSync('apps/web/app/customer-export.tsx','utf8');
 const owner=readFileSync('apps/web/app/customer-records.tsx','utf8');
 assert.match(ui,/verifiedCustomerExport\(/);
 assert.match(ui,/\{organization,customer\}/);
 assert.match(owner,/<CustomerExport key=\{'export:'\+organization\+':'\+detail\.customer\.id\} organization=\{organization\} customer=\{detail\.customer\.id\}\/>/);
});
