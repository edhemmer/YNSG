import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priorityServiceCities,geographicMarketingPolicy} from '../packages/domain/service-geography.mjs';
import {serviceCities,seo} from '../scripts/seo.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('one authoritative nine-town marketing target across website, settings and SEO schema',()=>{
 const expected=['DeKalb','Sycamore','Cortland','Maple Park','Elburn','Lily Lake','Campton Hills','Geneva','St. Charles'];
 assert.deepEqual([...priorityServiceCities],expected);
 assert.deepEqual([...serviceCities],expected);
 assert.match(read('apps/web/app/company-settings.tsx'),/cities: \[\.\.\.priorityServiceCities\]/);
 const form=read('site/pages/form.html'),list=form.match(/<datalist id="nearby-cities">([^<]*(?:<option[^>]*>[^<]*)*)<\/datalist>/);
 assert.ok(list,'City suggestions must exist');
 assert.deepEqual([...list[1].matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),expected);
 for(const name of expected)assert.ok(read('site/pages/service-area.html').includes(name));
 assert.deepEqual(JSON.parse(seo('service-area','Area','Description').schema)['@graph'][0].areaServed.map(place=>place.name),expected.map(city=>city+', Illinois'));
});
test('geography stays advisory; no three-town restriction is allowed in public intake',()=>{
 assert.equal(geographicMarketingPolicy.hardGeographicRejection,false);
 assert.equal(geographicMarketingPolicy.acceptNearbyRequests,true);
 const checker=read('api/address-check.js');
 assert.doesNotMatch(checker,/\['dekalb','sycamore','cortland'\]/);
 const area=read('site/pages/service-area.html');
 assert.match(area,/All genuine service requests can be submitted/);
 assert.doesNotMatch(area,/Our primary service area is Sycamore, DeKalb and Cortland/);
 assert.match(read('site/pages/form.html'),/name="city"/);
});
