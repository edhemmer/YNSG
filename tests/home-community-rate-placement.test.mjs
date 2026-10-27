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

test('homepage service cards open local landing pages rather than booking',()=>{
 const home=readFileSync('site/pages/home.html','utf8');
 const services=readFileSync('site/pages/services.html','utf8');
 const slugs=['handyman-dekalb-il','lawn-mowing-dekalb-il','mulch-yard-cleanup-dekalb-il','snow-removal-dekalb-il','concrete-pressure-washing-dekalb-il'];
 for(const slug of slugs) assert.match(home,new RegExp('class="home-service" href="/'+slug+'/"'));
 assert.match(home,/class="home-service" href="\/services\/#something-else"/);
 assert.doesNotMatch(home,/class="home-service" href="\/request\//);
 assert.match(services,/<article id="something-else">/);
});
