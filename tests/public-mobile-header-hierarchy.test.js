import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
test('phone header prioritizes the intact original logo with one calm navigation row',()=>{
 assert.match(source,/src="\/assets\/logo.webp"/);
 assert.match(source,/width="280" height="187"/);
 assert.doesNotMatch(source,/class="brand-identity"/);
 assert.match(css,/\.site-header \.header-actions,\.site-header \.nav-desktop\{display:none!important\}/);
 assert.match(css,/\.site-header \.nav-mobile\{display:grid;grid-column:1;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.mobile-rail\{display:none!important\}/);
 assert.match(css,/\.site-header \.brand\{grid-column:1;grid-row:1;justify-self:center/);
});

test('mobile primary navigation remains four balanced links while account sign in stays available',()=>{
 assert.match(source,/const primaryLinks = nav\.map/);
 assert.match(source,/<nav class="nav-mobile" aria-label="Main mobile navigation">\$\{primaryLinks\}<\/nav>/);
 assert.match(source,/<nav class="nav-desktop" aria-label="Main">\$\{links\}<\/nav>/);
 assert.match(source,/<a href="https:\/\/yourneighborhoodserviceguy\.app\/account">Customer sign in<\/a>/);
 assert.match(source,/<a href="https:\/\/yourneighborhoodserviceguy\.app\/account">Customer sign in<\/a>/);
 assert.match(source,/<a href="\/business-community-partners\/">Business &amp; community partners<\/a>/);
});
