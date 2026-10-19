import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('CRM sends origin-only cross-site referrers for Maps without exposing private paths',async()=>{
 const source=await readFile(new URL('../apps/web/next.config.ts',import.meta.url),'utf8');
 assert.match(source,/key:'Referrer-Policy',value:'strict-origin-when-cross-origin'/);
 assert.match(source,/key:'X-Frame-Options',value:'DENY'/);
});

test('owner page metadata does not suppress the origin required by Maps',async()=>{
 const source=await readFile(new URL('../apps/web/app/owner/page.tsx',import.meta.url),'utf8');
 assert.match(source,/referrer: "strict-origin-when-cross-origin"/);
});
