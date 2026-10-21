import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/premium.css',import.meta.url),'utf8');
test('official logo sits in dedicated masthead with no duplicate tagline',()=>{
 assert.match(build,/class="brand-stage"><a class="brand"/);
 assert.match(build,/src="\/assets\/logo.jpg"/);
 assert.doesNotMatch(build,/class="brand-stage-tagline"/);
 assert.match(css,/\.site-header \.brand-stage\{display:flex;flex:0 0 100%/);
 assert.match(css,/\.site-header \.brand-stage \.brand\{display:block;width:min\(360px,90vw\)/);
 assert.match(css,/\.site-header \.brand-stage \.brand\{display:block;width:min\(340px,92vw\)/);
});
