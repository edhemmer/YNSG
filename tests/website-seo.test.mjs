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
