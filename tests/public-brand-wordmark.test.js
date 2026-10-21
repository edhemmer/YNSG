import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
test('website preserves original logo as dominant brand across desktop and mobile',()=>{
 assert.match(build,/src="\/assets\/logo.jpg"/);
 assert.match(build,/alt="Your Neighborhood Service Guy/);
 assert.doesNotMatch(build,/class="brand-identity"/);
 assert.match(css,/\.site-header \.brand\{grid-column:1\/-1;justify-self:center/);
 assert.match(css,/\.site-header \.brand img\{display:block;width:100%;max-width:none/);
 assert.match(css,/@media\(max-width:390px\)/);
});
