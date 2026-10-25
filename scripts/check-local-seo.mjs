import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { canonicalUrl, localServicePages } from './seo.mjs';

export async function verifyLocalSeo(output = join(process.cwd(), 'dist')) {
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  const robots = await readFile(join(output, 'robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/www\.yourneighborhoodserviceguy\.com\/sitemap\.xml/);
  const sources = ['', 'services', 'service-area'];
  const pages = Object.keys(localServicePages);
  for (const slug of [...sources, ...pages]) {
    const url = canonicalUrl(slug);
    const html = await readFile(join(output, slug, 'index.html'), 'utf8');
    assert.ok(sitemap.includes('<loc>' + url + '</loc>'), 'Missing sitemap URL ' + url);
    assert.ok(html.includes('<link rel="canonical" href="' + url + '">'), 'Missing canonical ' + slug);
    assert.match(html, /<meta name="description" content="[^"]{50,160}">/, 'Missing/invalid description ' + slug);
    assert.match(html, /<h1[ >]/, 'Missing H1 ' + slug);
    assert.match(html, /application\/ld\+json/, 'Missing JSON-LD ' + slug);
    assert.match(html, /href="\/request\/?(?:[?"#])/, 'Missing request action ' + slug);
    const match = html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/);
    assert.ok(match, 'Missing schema content ' + slug);
    const graph = JSON.parse(match[1])['@graph'];
    assert.ok(graph.some(node => node['@type'] === 'WebPage' && node.url === url), 'Missing WebPage entity ' + slug);
    if (pages.includes(slug)) {
      assert.ok(graph.some(node => node['@type'] === 'Service' && node.url === url), 'Missing Service entity ' + slug);
      for (const parent of sources) {
        const parentHtml = await readFile(join(output, parent, 'index.html'), 'utf8');
        assert.ok(parentHtml.includes('href="/' + slug + '"') || parentHtml.includes('href="/' + slug + '/"'), 'Missing link from ' + (parent || 'home') + ' to ' + slug);
      }
    }
  }
  console.log('Verified ' + (sources.length + pages.length) + ' crawlable local SEO pages and all service links.');
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  await verifyLocalSeo();
}
