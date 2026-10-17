import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('homepage focuses on appointments rather than publishing hourly prices',()=>{
 const home=readFileSync('site/pages/home.html','utf8');
 assert.doesNotMatch(home,/Community Rate|\$45\/hour|\$60\/hour|two-hour minimum/i);
 assert.match(home,/confirm the price with you before scheduling/);
 assert.match(home,/>Request service appointment(?:\s|<)/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.doesNotMatch(build,/nav-request-short[^>]*>Request appt</);
 assert.match(build,/nav-request-short[^>]*>Request service appointment</);
});
test('request details explain Community Rate while preserving the original Yes No input contract',()=>{
 const form=readFileSync('site/pages/form.html','utf8');
 const pricing=form.match(/<fieldset class="form-field community-choice">[\s\S]*?<\/fieldset>/)?.[0]||'';
 assert.match(pricing,/\$45\/hour/);
 assert.match(pricing,/name="communityRate" value="Yes"/);
 assert.match(pricing,/name="communityRate" value="No" checked/);
 assert.match(pricing,/confirm eligibility and pricing/);
});
