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
test('partner SEO covers specific services, geography and business audience without publishing prices',async()=>{
 const nodes=graph('business-community-partners');
 const service=nodes.find(node=>node['@type']==='Service');
 assert.equal(service.audience['@type'],'BusinessAudience');
 assert.match(service.name,/Commercial handyman/i);
 assert.match(service.description,/churches/i);
 assert.match(service.description,/Sycamore/);
 assert.equal(service.provider['@id'],nodes[0]['@id']);
 const page=await readFile('site/pages/business-community-partners.html','utf8');
 assert.match(page,/rental turnovers/i);
 assert.match(page,/href="\/farm-hand-dekalb-il\/"/);
 assert.match(page,/href="\/service-area\/"/);
 assert.doesNotMatch(page,/\$\s?\d/);
});
test('updated titles stay within the search display limit',()=>{
 for(const slug of ['pricing','business-community-partners','realtors-property-managers','snow-removal-dekalb-il'])assert.ok(seo(slug,'x','y').title.length<=60,slug);
});

test('public pages speak to customers and partners rather than expose internal form comparisons',async()=>{
 for(const path of ['site/pages/home.html','site/pages/business-community-partners.html','site/pages/service-area.html','site/pages/privacy.html']){
  const content=await readFile(path,'utf8');
  assert.doesNotMatch(content,/separate from our homeowner appointment|not the homeowner appointment calendar|all genuine service requests|no fixed distance customers need to calculate|when delivery is available, the form sends|not enroll you in marketing emails/i,path);
 }
 const home=await readFile('site/pages/home.html','utf8');
 assert.match(home,/href="\/business-community-partners\/"/);
 const partner=await readFile('site/pages/business-community-partners.html','utf8');
 assert.match(partner,/id="partner-form"/);
});
