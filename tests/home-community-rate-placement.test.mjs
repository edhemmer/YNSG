import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('homepage and estimates explain fair rates without displaying public prices',()=>{
 const home=readFileSync('site/pages/home.html','utf8');
 const pricingPage=readFileSync('site/pages/pricing.html','utf8');
 assert.match(home,/fair hourly rate/);
 assert.match(home,/Community Rate/);
 assert.ok(home.includes('href="/pricing/"'));
 assert.match(pricingPage,/fair hourly rate/i);
 assert.match(pricingPage,/not-to-exceed cap/);
 assert.match(pricingPage,/Community Rate/);
 for(const source of [home,pricingPage])assert.doesNotMatch(source,/\$\s?\d[\d,.]*/);
 assert.match(home,/>Request service appointment(?:\s|<)/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.doesNotMatch(build,/nav-request-short[^>]*>Request appt</);
 assert.match(build,/nav-request-short[^>]*>Request service appointment</);
});
test('request details preserve community eligibility without public amounts or changing Yes No inputs',()=>{
 const form=readFileSync('site/pages/form.html','utf8');
 const section=form.match(/<fieldset class="form-field community-choice">[\s\S]*?<\/fieldset>/)?.[0]||'';
 assert.match(section,/Community Rate/);
 assert.doesNotMatch(section,/\$\s?\d[\d,.]*/);
 assert.match(section,/name="communityRate" value="Yes"/);
 assert.match(section,/name="communityRate" value="No" checked/);
 assert.match(section,/confirm eligibility and pricing/);
});
test('homepage service cards open local landing pages rather than booking',()=>{
 const home=readFileSync('site/pages/home.html','utf8');
 const services=readFileSync('site/pages/services.html','utf8');
 const slugs=['handyman-dekalb-il','lawn-mowing-dekalb-il','mulch-yard-cleanup-dekalb-il','snow-removal-dekalb-il','concrete-pressure-washing-dekalb-il'];
 for(const slug of slugs)assert.match(home,new RegExp('class="home-service" href="/'+slug+'/"'));
 assert.match(home,/class="home-service" href="\/leaf-cleanup-dekalb-il\/"/);
 assert.doesNotMatch(home,/class="home-service" href="\/request\//);
 assert.match(services,/<article id="something-else"[^>]*>/);
});
