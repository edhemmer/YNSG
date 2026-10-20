import test from 'node:test';
import assert from 'node:assert/strict';
import { seo, WEBSITE_ORIGIN, canonicalUrl } from '../scripts/seo.mjs';

test('Local business identity and geography are consistent across indexable pages', () => {
  for (const slug of ['', 'services', 'service-area', 'pricing', 'about', 'request']) {
    const result = seo(slug, 'Page', 'Useful local page');
    const graph = JSON.parse(result.schema)['@graph'];
    const business = graph.find(node => node['@id'] === WEBSITE_ORIGIN + '/#business');
    assert.ok(business);
    assert.deepEqual(business['@type'], ['LocalBusiness', 'HomeAndConstructionBusiness']);
    assert.equal(business.url, WEBSITE_ORIGIN + '/');
    assert.equal(business.telephone, '+1-770-630-2094');
    assert.deepEqual(business.areaServed.map(place => place.name), [
      'DeKalb, Illinois', 'Sycamore, Illinois', 'Cortland, Illinois'
    ]);
    assert.equal(graph.find(node => node['@type'] === 'WebPage').url, canonicalUrl(slug));
    assert.ok(!('aggregateRating' in business));
    assert.ok(!('review' in business));
    assert.ok(!('address' in business), 'Do not invent a business street address');
  }
});

test('Service schema follows approved service restrictions and has distinct identifiers', () => {
  const graph = JSON.parse(seo('services', 'Services', 'Home services').schema)['@graph'];
  const services = graph.filter(node => node['@type'] === 'Service');
  assert.equal(services.length, 5);
  assert.equal(new Set(services.map(service => service['@id'])).size, services.length);
  for (const service of services) {
    assert.equal(service.provider['@id'], WEBSITE_ORIGIN + '/#business');
    assert.equal(service.serviceType, service.name);
    assert.ok(service.url.startsWith(canonicalUrl('services')));
    assert.equal(service.areaServed.length, 3);
  }
  assert.match(services.find(service => service.name === 'Residential snow clearing').description, /No salt, deicer or commercial plowing/);
  assert.match(services.find(service => service.name === 'Concrete pressure washing').description, /customer supplies accessible outdoor water/);
});
