import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessIdentity} from '../lib/business-identity.js';
test('search verification tokens are optional, empty until the owner supplies them, and validated by the build',async()=>{
 assert.deepEqual(Object.keys(businessIdentity.searchVerification).sort(),['bing','google']);
 for(const v of Object.values(businessIdentity.searchVerification))assert.ok(v===''||/^[A-Za-z0-9_-]{20,100}$/.test(v));
 const build=await readFile('scripts/build.mjs','utf8');
 assert.match(build,/Invalid search verification token/);assert.match(build,/google-site-verification/);assert.match(build,/msvalidate\.01/);
});
test('owner-stated hours appear in search data and the footer',async()=>{
 assert.deepEqual(businessIdentity.hours.days,['Monday','Tuesday','Wednesday','Thursday','Friday']);
 assert.equal(businessIdentity.hours.opens,'08:00');assert.equal(businessIdentity.hours.closes,'17:00');
 assert.match(await readFile('scripts/seo.mjs','utf8'),/openingHoursSpecification/);
 assert.match(await readFile('scripts/build.mjs','utf8'),/footer-hours/);
});
