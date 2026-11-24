import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('home page explains the process right after the hero and keeps promos below the FAQ',()=>{
 assert.ok(home.indexOf('how-it-works')>0&&home.indexOf('how-it-works')<home.indexOf('id="services"'),'how it works sits above the services');
 assert.ok(home.indexOf('{{SERVICE_SATURDAY_BANNER}}')>home.indexOf('id="faq"'),'giveaway banner is below the FAQ');
 assert.ok(home.indexOf('class="seasonal-offer')>home.indexOf('id="faq"'),'seasonal offer is below the FAQ');
});
test('phones get a Call and Request bar on every page except the request form',()=>{
 assert.match(build,/data-sticky-cta/);assert.match(build,/tel:\+18156801775/);assert.match(build,/slug==='request'\|\|slug==='form'/);
});
test('/review sends neighbors straight to the Google review form',()=>{
 const r=vercel.redirects.filter(x=>x.source==='/review'||x.source==='/review/');assert.equal(r.length,2);
 for(const x of r)assert.equal(x.destination,'https://g.page/r/CWxW2KabD1UWECE/review');
});
