import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
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
 assert.match(page,/href="tel:\+18156801775"/);
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

test('public booking messaging and SEO snippets reflect review before approval',()=>{
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const home=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
 assert.match(page,/contact you about the work, cost and available times/);
 assert.match(page,/confirmed only after we approve it/);
 assert.match(home,/review the details before confirming an appointment/);
 assert.match(build,/confirm appointments after approval/);
 assert.doesNotMatch(build,/We will confirm scope, cost and timing/);
});


test('all published website pages and operational contact fallbacks use the current phone',()=>{
 const pages=new URL('../site/pages/',import.meta.url);
 const oldPhone=/770[-.\s]?630[-.\s]?2094|\+?1?7706302094/;
 for(const file of readdirSync(pages).filter(name=>name.endsWith('.html'))){
  const body=readFileSync(new URL(file,pages),'utf8');
  assert.doesNotMatch(body,oldPhone, file+' still contains the retired phone');
  for(const [,scheme,phone] of body.matchAll(/href="(tel|sms):([^"#?]+)"/g))
   assert.equal(phone,'+18156801775',file+' has an incorrect '+scheme+' destination');
 }
 for(const file of ['../scripts/build.mjs','../site/main.js','../lib/website-availability.js','../lib/public-intake.js','../api/requests.js'])
  assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),'utf8'),oldPhone,file+' has retired contact details');
 const hero=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
 assert.match(hero,/href="tel:\+18156801775">Press to call 815-680-1775<\/a>/);
});
