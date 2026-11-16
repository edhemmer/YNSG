import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {seo} from '../scripts/seo.mjs';
const graph=slug=>JSON.parse(seo(slug,'Title','Description').schema)['@graph'];

test('public pricing page offers fair hourly rates without publishing amounts',async()=>{
 const page=await readFile('site/pages/pricing.html','utf8');
 assert.match(page,/fair hourly rate/i);
 assert.match(page,/Community Rate/);
 assert.match(page,/individual estimate/i);
 assert.doesNotMatch(page,/\$\s?\d[\d,.]*/);
 for(const slug of ['pricing','']){
  const nodes=graph(slug);
  assert.equal(nodes.some(node=>node['@type']==='OfferCatalog'),false);
  assert.equal(nodes[0].priceRange,undefined);
  assert.doesNotMatch(JSON.stringify(nodes),/priceSpecification|UnitPriceSpecification|\$45|\$70/);
 }
});
test('business links its Google profile and the partner page describes a business audience',()=>{
 const business=graph('')[0];
 assert.equal(business.hasMap,'https://g.page/r/CWxW2KabD1UWECE');
 const partner=graph('realtors-property-managers').find(n=>n['@type']==='Service');
 assert.equal(partner.audience['@type'],'BusinessAudience');
 assert.equal(partner.provider['@id'],business['@id']);
});
test('updated titles stay within the search display limit',()=>{
 for(const slug of ['pricing','realtors-property-managers','snow-removal-dekalb-il'])assert.ok(seo(slug,'x','y').title.length<=60,slug);
});
