import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('homepage presents standard rate without advertising community pricing',()=>{
 const home=readFileSync('site/pages/home.html','utf8');
 assert.match(home,/\$60\/hour/);
 assert.doesNotMatch(home,/Community Rate|\$45\/hour/);
 assert.match(home,/Request service appt/);
});
test('request details explain Community Rate while preserving the original Yes No input contract',()=>{
 const form=readFileSync('site/pages/form.html','utf8');
 const pricing=form.match(/<fieldset class="form-field community-choice">[\s\S]*?<\/fieldset>/)?.[0]||'';
 assert.match(pricing,/\$45\/hour/);
 assert.match(pricing,/name="communityRate" value="Yes"/);
 assert.match(pricing,/name="communityRate" value="No" checked/);
 assert.match(pricing,/confirm eligibility and pricing/);
});
