import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../site/pages/request.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/booking.css',import.meta.url),'utf8');
test('service request clearly allows guest use and labels optional customer account',()=>{
 assert.match(page,/No account needed/);
 assert.match(page,/Both are optional/);
 assert.match(page,/yourneighborhoodserviceguy\.app\/account/);
 assert.match(page,/mode=signup/);
 assert.doesNotMatch(page,/continue below as a guest|Call or text/);
});
test('contact option matches actual phone action and visual grouping',()=>{
 assert.match(page,/Rather call\?/);
 assert.match(page,/href="tel:\+17706302094"/);
 assert.match(css,/request-side-group\+\.request-side-group/);
});
