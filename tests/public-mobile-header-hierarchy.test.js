import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
test('phone header prioritizes the intact original logo with one calm navigation row',()=>{
 assert.match(source,/src="\/assets\/logo.jpg"/);
 assert.match(source,/width="280" height="187"/);
 assert.doesNotMatch(source,/class="brand-identity"/);
 assert.match(css,/\.site-header \.header-actions,\.site-header \.nav-desktop\{display:none!important\}/);
 assert.match(css,/\.site-header \.nav-mobile\{display:grid;grid-column:1;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.mobile-rail\{display:none!important\}/);
 assert.match(css,/\.site-header \.brand img\{width:100%;max-width:244px/);
});
