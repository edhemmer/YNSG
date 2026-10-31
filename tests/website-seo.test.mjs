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
 assert.ok(html.includes('id="appointment-quick-dates"'));assert.ok(html.includes('Let YNSG arrange a time'));
 for(const id of ['name','phone','email','street','city'])assert.match(html,new RegExp('<(?:input|select)[^>]*id="'+id+'"[^>]*required'));
});

test('search service URLs resolve to visible public sections and breadcrumb references resolve',async()=>{
 const services=await readFile(new URL('../site/pages/services.html',import.meta.url),'utf8');
 for(const slug of ['','services','service-area']){
  const graph=JSON.parse(seo(slug,'Page','Description').schema)['@graph'];
  const nodes=graph.filter(v=>v['@type']==='Service');assert.equal(nodes.length,6);
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

test('service-area description matches the intake without duplicate ZIP lists',async()=>{
 const html=await readFile(new URL('../site/pages/service-area.html',import.meta.url),'utf8');
 for(const city of serviceCities)assert.ok(html.includes(city));
 assert.ok(html.includes('Enter your address when requesting an appointment'));
 assert.ok(html.includes('we’ll confirm whether we can serve it'));
 assert.ok(!html.includes('Do you serve every address in these ZIP codes?'));
 for(const slug of ['','services'])assert.match(seo(slug,'Page','Description').title,/Home|Yard/);
});

test('search landing pages provide specific guidance without imposing handyman-first homepage copy',async()=>{
 const home=await readFile(new URL('../site/pages/home.html',import.meta.url),'utf8');
 const handyman=await readFile(new URL('../site/pages/handyman-dekalb-il.html',import.meta.url),'utf8');
 const lawn=await readFile(new URL('../site/pages/lawn-mowing-dekalb-il.html',import.meta.url),'utf8');
 const leaves=await readFile(new URL('../site/pages/leaf-cleanup-dekalb-il.html',import.meta.url),'utf8');
 assert.match(home,/Home and yard services/);
 assert.match(handyman,/What does a small handyman visit cost\\?/);
 assert.match(lawn,/How much does lawn mowing cost\\?/);
 assert.match(leaves,/<h1>Leaf management/);
 assert.match(leaves,/discuss the approach, timing and cost/);
 assert.doesNotMatch(leaves,/gather and bag|gathering and bagging|hauling and disposal must/i);
 for(const html of [handyman,lawn,leaves]){
  assert.ok(html.includes('href="/pricing/"'));
  assert.match(html,/href="\/request\/(?:\?[^"]*)?"/);
 }
 assert.match(seo('', 'Page','Description').title,/Home & Yard Services/);
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
  assert.match(html,/href="\/request\/(?:\?[^"]*)?"/,slug+' missing appointment request');
  assert.ok(html.includes('href="/pricing/"'),slug+' missing pricing link');
 }
});

test('homepage primary service cards link directly to indexable local service pages',async()=>{
 const html=await readFile(new URL('../site/pages/home.html',import.meta.url),'utf8');
 const urls=['handyman-dekalb-il','lawn-mowing-dekalb-il','mulch-yard-cleanup-dekalb-il','snow-removal-dekalb-il','concrete-pressure-washing-dekalb-il'];
 for(const slug of urls){
  assert.match(html,new RegExp('<a class="home-service" href="/'+slug+'/"(?:\\s|>)'),slug+' card must lead to the relevant service page');
 }
});

test('service-area page accepts inquiries outside the primary towns',async()=>{
 const page=await readFile(new URL('../site/pages/service-area.html',import.meta.url),'utf8');
 assert.match(page,/Our primary service area is Sycamore, DeKalb and Cortland/);
 assert.match(page,/we’ll confirm whether we can serve it/);
 assert.match(page,/Enter your address when requesting an appointment/);
});

test('customers can request service without choosing a calendar time',async()=>{
 const html=await readFile(new URL('../site/pages/form.html',import.meta.url),'utf8');
 assert.match(html,/Choosing a time is optional/);
 assert.match(html,/id="calendar-clear">Let YNSG arrange a time/);
 assert.equal((html.match(/id="calendar-clear"/g)||[]).length,1);
 const picker=html.slice(html.indexOf('id="appointment-picker"'),html.indexOf('</fieldset>',html.indexOf('id="appointment-picker"')));
 assert.match(picker,/id="calendar-clear"/,'Calendar-free action must remain within picker used by interactive JavaScript');
});


test('mulch has a distinct discoverable page while garden care stays in Yard & garden',async()=>{const home=await readFile(new URL('../site/pages/home.html',import.meta.url),'utf8'),mulch=await readFile(new URL('../site/pages/mulch-delivery-spreading-dekalb-il.html',import.meta.url),'utf8');assert.equal((home.match(/<article class="home-service-card/g)||[]).length,9);assert.match(home,/href="\/mulch-delivery-spreading-dekalb-il\/"/);assert.match(home,/Hand weeding, small planting, bush trimming and garden-bed cleanup/);assert.match(mulch,/Supplier-prepaid materials are not billed again/);assert.match(mulch,/one combined two-hour minimum/);assert.match(mulch,/href="\/mulch-yard-cleanup-dekalb-il\/"/);});

test('farm hand has a distinct daily-rate page, service panel and full-day arranged intake',async()=>{
 const [home,services,price,farm,form,journey,catalog]=await Promise.all([
  'home.html','services.html','pricing.html','farm-hand-dekalb-il.html','form.html'
 ].map(file=>readFile(new URL('../site/pages/'+file,import.meta.url),'utf8')).concat([
  readFile(new URL('../site/booking-journey.js',import.meta.url),'utf8'),
  readFile(new URL('../site/service-catalog.js',import.meta.url),'utf8')
 ]));
 assert.match(home,/href="\/farm-hand-dekalb-il\/"/);
 assert.match(services,/id="farm-hand"/);
 assert.match(price,/\$300 per day for one farm hand, up to 10 hours/);
 assert.match(farm,/Need an extra hand on the farm\?/);
 assert.match(farm,/Spring planting support|spring planting support/);
 assert.match(farm,/fall harvest support/i);
 assert.match(farm,/href="\/request\/\?service=Farm%20hand%20services/);
 assert.match(form,/id="farm-day-note"/);
 assert.match(journey,/farmDay\(\)/);
 assert.match(catalog,/'Farm hand services':\['Spring planting support'/);
 const graph=JSON.parse(seo('farm-hand-dekalb-il','Farm Hand','Seasonal farm labor').schema)['@graph'];
 assert.ok(graph.some(node=>node['@type']==='Service'&&node.url===canonicalUrl('farm-hand-dekalb-il')));
});
