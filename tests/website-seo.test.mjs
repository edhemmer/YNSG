import test from 'node:test';
import assert from 'node:assert/strict';
import {seo,canonicalUrl,serviceCities} from '../scripts/seo.mjs';
import {readFile} from 'node:fs/promises';
test('local metadata uses canonical hosting URLs and real service cities without invented locations or reviews',()=>{
 for(const slug of ['','services','pricing','about','request','service-area']){
  const metadata=seo(slug,'Page','Local service description'),graph=JSON.parse(metadata.schema)['@graph'];
  assert.equal(metadata.url,canonicalUrl(slug));assert.ok(slug?!metadata.url.endsWith('/'):metadata.url.endsWith('/'));
  assert.equal(graph.find(v=>v['@type']==='WebPage').url,metadata.url);
  assert.deepEqual(graph[0].areaServed.map(v=>v.name),serviceCities.map(v=>v+', Illinois'));
  assert.equal(graph[0].telephone,'+1-770-630-2094');
  assert.ok(!metadata.schema.includes('streetAddress')&&!metadata.schema.includes('aggregateRating'));
  assert.ok(!metadata.schema.includes('licensed')&&!metadata.schema.includes('guaranteed'));
 }
});
test('customer booking keeps service, time and required details in ordered stages with an explicit arrange-time path',async()=>{
 const html=await readFile(new URL('../site/pages/form.html',import.meta.url),'utf8');
 assert.ok(!html.includes('appointment-disclosure'));
 assert.ok(html.includes('<details class="calendar-all-dates"'));
 assert.ok(html.indexOf('id="appointment-quick-dates"')<html.indexOf('id="appointment-days"'));
 assert.ok(html.indexOf('id="appointment-times"')<html.indexOf('id="appointment-days"'));
 assert.ok(html.indexOf('id="appointment-days"')<html.indexOf('id="name"'));
 assert.ok(html.indexOf('id="appointment-picker"')<html.indexOf('id="name"'));
 assert.ok(html.includes('id="appointment-quick-dates"'));assert.ok(html.includes('Arrange a time with me instead'));
 for(const id of ['name','phone','email','street','city'])assert.match(html,new RegExp('<(?:input|select)[^>]*id="'+id+'"[^>]*required'));
});

test('search service URLs resolve to visible public sections and breadcrumb references resolve',async()=>{
 const services=await readFile(new URL('../site/pages/services.html',import.meta.url),'utf8');
 for(const slug of ['','services','service-area']){
  const graph=JSON.parse(seo(slug,'Page','Description').schema)['@graph'];
  const nodes=graph.filter(v=>v['@type']==='Service');assert.equal(nodes.length,5);
  for(const service of nodes){
   const destination=new URL(service.url);
   assert.equal(destination.origin,'https://www.yourneighborhoodserviceguy.com');assert.equal(destination.pathname,'/services');
   assert.ok(services.includes(`id="${destination.hash.slice(1)}"`));
   assert.equal(service['@id'],service.url);
  }
  if(slug){
   const page=graph.find(v=>v['@type']==='WebPage'),crumb=graph.find(v=>v['@type']==='BreadcrumbList');
   assert.equal(page.breadcrumb['@id'],crumb['@id']);assert.equal(crumb.itemListElement.at(-1).item,page.url);
  }
 }
});

test('public city ZIP guidance agrees with the intake choices and local titles cover all served cities',async()=>{
 const {postalCodesForCity}=await import('../site/city-postal-codes.js');
 const html=await readFile(new URL('../site/pages/service-area.html',import.meta.url),'utf8');
 for(const city of serviceCities){for(const zip of postalCodesForCity(city))assert.ok(html.includes(`${city}, Illinois ${zip}`));for(const slug of ['','services'])assert.ok(seo(slug,'Page','Description').title.includes(city));}
 assert.ok(html.includes('a ZIP code alone does not confirm service availability'));
});

test('search landing pages give customers distinct, specific guidance rather than keyword-only pages',async()=>{
 const home=await readFile(new URL('../site/pages/home.html',import.meta.url),'utf8');
 const handyman=await readFile(new URL('../site/pages/handyman-dekalb-il.html',import.meta.url),'utf8');
 const lawn=await readFile(new URL('../site/pages/lawn-mowing-dekalb-il.html',import.meta.url),'utf8');
 const leaves=await readFile(new URL('../site/pages/leaf-cleanup-dekalb-il.html',import.meta.url),'utf8');
 assert.match(home,/Handyman, lawn care &amp; yard help in DeKalb/);
 assert.match(handyman,/What does a small handyman visit cost\?/);
 assert.match(lawn,/How much does lawn mowing cost\?/);
 assert.match(leaves,/What happens to the leaves\?/);
 for(const html of [handyman,lawn,leaves]){
  assert.match(html,/href="\/pricing\/"/);
  assert.match(html,/href="\/request\/"/);
 }
 assert.match(seo('', 'Page','Description').title,/Handyman & Lawn Care in DeKalb/);
});

test('main service categories link directly to detailed local landing pages',async()=>{
 const html=await readFile(new URL('../site/pages/services.html',import.meta.url),'utf8');
 for(const slug of ['handyman-dekalb-il','lawn-mowing-dekalb-il','leaf-cleanup-dekalb-il','mulch-yard-cleanup-dekalb-il','snow-removal-dekalb-il','concrete-pressure-washing-dekalb-il']){
  assert.ok(html.includes('href="/'+slug+'/"'),'Missing specific service link: '+slug);
 }
});

test('seasonal local service pages answer project-specific customer questions',async()=>{
 const expectations=[
  ['snow-removal-dekalb-il','What to know before requesting snow clearing'],
  ['mulch-yard-cleanup-dekalb-il','Preparing for mulch delivery and spreading'],
  ['concrete-pressure-washing-dekalb-il','Is your concrete suitable for pressure washing?']
 ];
 for(const [slug,heading] of expectations){
  const html=await readFile(new URL('../site/pages/'+slug+'.html',import.meta.url),'utf8');
  assert.ok(html.includes(heading),slug+' missing practical project guidance');
  assert.ok(html.includes('href="/request/"'),slug+' missing appointment request');
  assert.ok(html.includes('href="/pricing/"'),slug+' missing pricing link');
 }
});

test('homepage primary service cards link directly to indexable local service pages',async()=>{
 const html=await readFile(new URL('../site/pages/home.html',import.meta.url),'utf8');
 const urls=['handyman-dekalb-il','lawn-mowing-dekalb-il','mulch-yard-cleanup-dekalb-il','snow-removal-dekalb-il','concrete-pressure-washing-dekalb-il'];
 for(const slug of urls){
  assert.match(html,new RegExp('<a class="home-service" href="/'+slug+'/">'),slug+' card must lead to the relevant service page');
 }
});

test('service-area page accepts inquiries outside the primary towns',async()=>{
 const page=await readFile(new URL('../site/pages/service-area.html',import.meta.url),'utf8');
 assert.match(page,/15-mile preferred operating area/);
 assert.match(page,/outside our preferred service radius will never automatically reject your inquiry/);
 assert.match(page,/Enter your city, five-digit ZIP code/);
});
