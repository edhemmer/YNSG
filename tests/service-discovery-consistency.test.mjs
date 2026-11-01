import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {serviceCatalog} from '../site/service-catalog.js';

const home=readFileSync(new URL('../site/pages/home.html',import.meta.url),'utf8');
const services=readFileSync(new URL('../site/pages/services.html',import.meta.url),'utf8');
const decode=s=>s.replaceAll('&amp;','&');
const cards=[...home.matchAll(/class="home-service-book" href="([^"]+)"/g)];
const choices=[...home.matchAll(/name="category" value="([^"]+)"/g)].map(m=>decode(m[1]));

test('every request category is available from the homepage without JavaScript',()=>{
 assert.deepEqual(new Set(choices),new Set(Object.keys(serviceCatalog)));
 assert.equal(choices.length,new Set(choices).size,'No duplicated category options');
});
test('every service card points to a real detail page and supported booking category',()=>{
 assert.ok(cards.length>=9,'Expected home, lawn, cleanout and farm service cards');
 for(const [,raw] of cards){
  const href=decode(raw),url=new URL(href,'https://www.yourneighborhoodserviceguy.com');
  const service=url.searchParams.get('service'),task=url.searchParams.get('task');
  assert.equal(url.pathname,'/request/');
  assert.ok(Object.hasOwn(serviceCatalog,service),'Unrecognized service: '+service);
  if(task)assert.ok(serviceCatalog[service].includes(task),'Unrecognized task: '+task);
 }
 for(const [,slug] of home.matchAll(/class="home-service" href="\/([^"]+)\/"/g))
  assert.ok(existsSync(new URL('../site/pages/'+slug+'.html',import.meta.url)),'Missing detail page: '+slug);
});
test('cleanout and farm offerings have linked detail pages and no homepage farm day price',()=>{
 for(const slug of ['cleanout-dekalb-il','farm-hand-dekalb-il'])
  assert.ok(services.includes('href="/'+slug+'/"'),'Services index must link '+slug);
 assert.ok(!/\$300/.test(home),'Farm day price belongs on service detail, not homepage card');
});
