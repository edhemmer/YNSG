import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
const home=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
test('official logo sits above navigation and hero without duplicated tagline artwork',()=>{
 assert.match(build,/<header class="site-header"><div class="shell header-row"><a class="brand"/);
 assert.match(css,/\.site-header \.brand\{grid-column:1\/-1;justify-self:center/);
 assert.match(css,/\.site-header \.nav-desktop\{grid-column:1;grid-row:2/);
 assert.match(css,/\.site-header \.nav-mobile\{grid-column:1;grid-row:2/);
 assert.doesNotMatch(home,/hero-motto|brand-tagline/);
 assert.match(build,/src="\/assets\/logo.jpg"/);
});
