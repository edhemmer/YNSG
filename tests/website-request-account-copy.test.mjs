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
 assert.match(page,/Have a question\?/);
 assert.match(page,/href="tel:\+17706302094"/);
 assert.match(css,/request-side-group\+\.request-side-group/);
});

test('customer-facing pages do not abbreviate the request action or promise an unapproved booking',()=>{
 const paths=['home','about','pricing','request'];
 for(const name of paths){
  const body=readFileSync(new URL('../site/pages/'+name+'.html',import.meta.url),'utf8');
  assert.doesNotMatch(body,/Request service appt(?:\\s|<)/i);
 }
 assert.match(page,/confirmed only after we approve it/);
 assert.match(readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8'),/No account needed to request service/);
});
