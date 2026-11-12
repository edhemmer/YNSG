import test from 'node:test';
import assert from 'node:assert/strict';
import { businessIdentity } from '../lib/business-identity.js';
import { seo, WEBSITE_ORIGIN, canonicalUrl, localServicePages } from '../scripts/seo.mjs';

test('each local landing page describes its own primary service with the same verified provider and geography', () => {
  assert.equal(Object.keys(localServicePages).length,10);
  for(const slug of Object.keys(localServicePages)){
    const graph=JSON.parse(seo(slug,'Service','Service details').schema)['@graph'];
    const page=graph.find(node=>node['@type']==='WebPage');
    const service=graph.find(node=>node['@id']===page.mainEntity['@id']);
    assert.equal(service['@type'],'Service');
    assert.equal(service.url,canonicalUrl(slug));
    assert.equal(service.mainEntityOfPage['@id'],page['@id']);
    assert.equal(service.provider['@id'],WEBSITE_ORIGIN+'/#business');
    assert.deepEqual(service.areaServed,graph[0].areaServed);
    assert.ok(!service.offers&&!service.review&&!service.aggregateRating);
  }
});

test('Local business identity and geography are consistent across indexable pages', () => {
  for (const slug of ['', 'services', 'service-area', 'pricing', 'about', 'request']) {
    const result = seo(slug, 'Page', 'Useful local page');
    const graph = JSON.parse(result.schema)['@graph'];
    const business = graph.find(node => node['@id'] === WEBSITE_ORIGIN + '/#business');
    assert.ok(business);
    assert.deepEqual(business['@type'], ['LocalBusiness', 'HomeAndConstructionBusiness']);
    assert.equal(business.url, WEBSITE_ORIGIN + '/');
    assert.equal(business.telephone, '+1-815-680-1775');
    assert.deepEqual(business.areaServed.map(place => place.name), [
      'DeKalb, Illinois', 'Sycamore, Illinois', 'Cortland, Illinois', 'Maple Park, Illinois', 'Elburn, Illinois', 'Lily Lake, Illinois', 'Campton Hills, Illinois', 'Geneva, Illinois', 'St. Charles, Illinois'
    ]);
    assert.equal(graph.find(node => node['@type'] === 'WebPage').url, canonicalUrl(slug));
    assert.ok(!('aggregateRating' in business));
    assert.ok(!('review' in business));
    assert.ok(!('address' in business), 'Do not invent a business street address');
    assert.deepEqual(business.image,[WEBSITE_ORIGIN+'/assets/logo.jpg',WEBSITE_ORIGIN+'/assets/neighbors-social.jpg']);
    assert.equal(business.priceRange,'$45-$70 per person per hour');
    const confirmed=[...businessIdentity.profiles,...Object.values(businessIdentity.social)].filter(Boolean);
    if(confirmed.length)assert.deepEqual(business.sameAs,confirmed,'sameAs is only the owner-confirmed profile and social URLs');
    else assert.ok(!('sameAs' in business),'sameAs is only published for owner-confirmed profile URLs');
  }
});

test('Service schema follows approved service restrictions and has distinct identifiers', () => {
  const graph = JSON.parse(seo('services', 'Services', 'Home services').schema)['@graph'];
  const services = graph.filter(node => node['@type'] === 'Service');
  assert.equal(services.length, 10);
  assert.equal(new Set(services.map(service => service['@id'])).size, services.length);
  for (const service of services) {
    assert.equal(service.provider['@id'], WEBSITE_ORIGIN + '/#business');
    assert.equal(service.serviceType, service.name);
    assert.ok(service.url.startsWith(canonicalUrl('services')));
    assert.equal(service.areaServed.length, 9);
  }
  assert.match(services.find(service => service.name === 'Residential snow clearing').description, /No salt, deicer or commercial plowing/);
  assert.match(services.find(service => service.name === 'Concrete pressure washing').description, /customer supplies accessible outdoor water/);
  assert.match(services.find(service => service.name === 'Farm hand services').description, /spring planting preparation, fall harvest support/);
});
