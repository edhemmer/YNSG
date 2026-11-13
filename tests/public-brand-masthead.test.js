import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
const home=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
test('official masthead remains above navigation and hero tagline reuses approved logo script',()=>{
 assert.match(build,/<header class="site-header"><div class="shell header-row"><a class="brand"/);
 assert.match(css,/\.site-header \.brand\{grid-column:1\/-1;justify-self:center/);
 assert.match(css,/\.site-header \.nav-desktop\{grid-column:1;grid-row:2/);
 assert.match(css,/\.site-header \.nav-mobile\{grid-column:1;grid-row:2/);
 assert.doesNotMatch(home,/hero-motto/);
 assert.match(home,/<svg class="brand-tagline"[^>]+role="img" aria-label="We’re Here to Help\."/);
 assert.match(home,/<image href="\/assets\/logo.webp" width="1536" height="1024" aria-hidden="true"\/>/);
 assert.equal((home.match(/class="brand-tagline"/g)||[]).length,1);
 assert.match(build,/src="\/assets\/logo.webp"/);
});
