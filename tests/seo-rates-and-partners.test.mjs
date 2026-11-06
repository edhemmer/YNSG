import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {seo,publishedRates} from '../scripts/seo.mjs';
const graph=s=>JSON.parse(seo(s,'Title','Description').schema)['@graph'];
test('pricing structured data matches the visible published rates',async()=>{
 const page=await readFile('site/pages/pricing.html','utf8');
 assert.match(page,new RegExp('\\$'+publishedRates.standard+' <span>/ person / hour</span>'));
 assert.match(page,new RegExp('\\$'+publishedRates.community+' <span>/ person / hour</span>'));
 const nodes=graph('pricing'),catalog=nodes.find(n=>n['@type']==='OfferCatalog');
 assert.deepEqual(catalog.itemListElement.map(o=>[o.name,o.priceSpecification.price,o.priceSpecification.unitCode,o.priceSpecification.priceCurrency]),[['Standard rate',70,'HUR','USD'],['Community Rate',45,'HUR','USD']]);
 assert.match(catalog.itemListElement[1].description,/single parents/);
 assert.equal(nodes.find(n=>n['@id']?.endsWith('#page')).mainEntity['@id'],catalog['@id']);
 assert.equal(graph('').some(n=>n['@type']==='OfferCatalog'),false,'rates appear only on the pricing page');
});
test('business links its Google profile and the partner page describes a business audience',()=>{
 const business=graph('')[0];
 assert.equal(business.hasMap,'https://g.page/r/CWxW2KabD1UWECE');
 const partner=graph('realtors-property-managers').find(n=>n['@type']==='Service');
 assert.equal(partner.audience['@type'],'BusinessAudience');assert.equal(partner.provider['@id'],business['@id']);
});
test('updated titles stay within the search display limit',()=>{
 for(const slug of ['pricing','realtors-property-managers','snow-removal-dekalb-il'])assert.ok(seo(slug,'x','y').title.length<=60,slug);
});
