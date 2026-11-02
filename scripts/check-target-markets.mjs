import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {priorityServiceCities} from '../packages/domain/service-geography.mjs';
import {serviceCities} from './seo.mjs';
const root=join(process.cwd(),'dist');
const load=async slug=>new JSDOM(await readFile(join(root,slug,'index.html'),'utf8')).window.document;
export async function checkTargetMarkets(){
 assert.deepEqual([...serviceCities],[...priorityServiceCities]);
 const [home,area,request]=await Promise.all([load(''),load('service-area'),load('request')]);
 assert.match(home.body.textContent,/Servicing your neighborhood/i);
 const areaText=area.body.textContent;
 for(const city of priorityServiceCities)assert.ok(areaText.includes(city),'Missing public target town: '+city);
 assert.doesNotMatch(areaText,/Our primary service area is Sycamore, DeKalb and Cortland/);
 assert.match(areaText,/All genuine service requests can be submitted/);
 const options=[...request.querySelectorAll('datalist#nearby-cities option')].map(o=>o.value);
 assert.deepEqual(options,[...priorityServiceCities],'Rendered city hints drifted from shared policy');
 assert.equal(request.querySelector('input#city')?.getAttribute('required'),'','Customer city must be entered');
 assert.equal(request.querySelector('input#city')?.getAttribute('list'),'nearby-cities');
 assert.ok(request.querySelector('a[href^="tel:+18156801775"]'));
 for(const page of [home,area]){
  const nodes=[...page.querySelectorAll('script[type="application/ld+json"]')].flatMap(el=>JSON.parse(el.textContent)['@graph']||[]);
  const business=nodes.find(node=>node['@id']==='https://www.yourneighborhoodserviceguy.com/#business');
  assert.ok(business,'Missing canonical local business schema');
  assert.deepEqual(business.areaServed.map(p=>p.name),priorityServiceCities.map(c=>c+', Illinois'));
 }
 console.log('PASS: rendered nine-town SEO, city hints, unrestricted area copy and business schema');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)await checkTargetMarkets();
