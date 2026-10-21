import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
test('phone header keeps company name readable with only compact navigation',()=>{
 assert.match(source,/class="brand-identity"/);
 assert.match(source,/Your Neighborhood<br>Service Guy/);
 assert.match(css,/\.site-header \.header-row\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.site-header \.header-actions,\.site-header \.nav-desktop\{display:none!important\}/);
 assert.match(css,/\.site-header \.nav-mobile\{display:grid;grid-column:1;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.mobile-rail\{display:none!important\}/);
 assert.match(css,/\.site-header \.brand-identity strong br\{display:none\}/);
});
