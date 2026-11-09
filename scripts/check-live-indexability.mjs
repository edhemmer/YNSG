// Verify the publicly served canonical URLs after deployment.
// Usage: node scripts/check-live-indexability.mjs [https://www.yourneighborhoodserviceguy.com]
import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'https://www.yourneighborhoodserviceguy.com');
assert.equal(origin.protocol, 'https:');
assert.equal(origin.pathname, '/');
const root = origin.origin;
const get = async (path, redirect = 'follow') => {
  const response = await fetch(new URL(path, root), {redirect, signal: AbortSignal.timeout(15000), headers: {'user-agent':'YNSG-Indexability-Check/1.0'}});
  return response;
};
const robots = await get('/robots.txt');
assert.equal(robots.status, 200, 'robots.txt must be publicly accessible');
const rules = await robots.text();
assert.match(rules, /User-agent:\s*\*/i);
assert.match(rules, /Sitemap:\s*https:\/\/www\.yourneighborhoodserviceguy\.com\/sitemap\.xml/i);
assert.doesNotMatch(rules, /Disallow:\s*\/\s*(?:\n|$)/i, 'The public site must not be blocked');
const sitemap = await get('/sitemap.xml');
assert.equal(sitemap.status, 200, 'sitemap.xml must be publicly accessible');
const xml = await sitemap.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
assert.ok(urls.length >= 10, 'Expected published public pages in sitemap');
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap entries');
const errors = [];
for (const address of urls) {
  try {
    const url = new URL(address);
    assert.equal(url.origin, root, 'Sitemap points outside preferred host');
    const response = await get(url.pathname + url.search, 'manual');
    assert.equal(response.status, 200, 'Canonical URL redirects or fails');
    assert.equal(response.headers.get('location'), null, 'Canonical redirects');
    const html = await response.text();
    assert.match(html, /<html[^>]+lang="en"/i, 'Not an HTML page');
    const canonicals = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/gi)];
    assert.equal(canonicals.length, 1, 'Expected one canonical');
    assert.equal(canonicals[0][1], address, 'Canonical disagrees with sitemap');
    assert.doesNotMatch(html, /<meta\s+name="robots"\s+content="[^"]*(?:noindex|none)/i, 'Noindex page in sitemap');
  } catch (error) { errors.push(address + ': ' + error.message); }
}
assert.deepEqual(errors, [], errors.join('\n'));
console.log('PASS: robots.txt and sitemap.xml served successfully; ' + urls.length + ' public URLs return 200 with matching self-canonicals and no noindex.');
