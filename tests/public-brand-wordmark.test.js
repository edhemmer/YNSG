import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
test('public header renders the full company name as prominent readable text beside the official logo',()=>{
 assert.match(build,/class="brand-identity"/);
 assert.match(build,/Your Neighborhood<br>Service Guy/);
 assert.match(build,/<small>Home &amp; Yard<\/small>/);
 assert.match(build,/src="\/assets\/logo.jpg"/);
 assert.match(css,/\.site-header \.brand-identity strong\{font-size:/);
 assert.match(css,/@media\(max-width:390px\)/);
});
