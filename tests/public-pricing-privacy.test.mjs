import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {seo} from '../scripts/seo.mjs';

async function htmlFiles(dir){
 const files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const full=join(dir,entry.name);
  if(entry.isDirectory()) files.push(...await htmlFiles(full));
  else if(entry.isFile() && entry.name.endsWith('.html')) files.push(full);
 }
 return files;
}
test('public templates do not advertise dollar amounts',async()=>{
 for(const path of await htmlFiles('site/pages')){
  const html=await readFile(path,'utf8');
  const withoutStatutoryThreshold=path.endsWith('service-agreement.html')?html.replace(/\$1,000/g,''):html;
  assert.doesNotMatch(withoutStatutoryThreshold,/\$\s?\d[\d,.]*/,path+' contains an advertised price');
  assert.doesNotMatch(html,/published rates|See all rates &amp; Community Rate details/i,path+' promises published rates');
 }
});
test('structured SEO data does not expose private rates',()=>{
 for(const slug of ['','pricing','realtors-property-managers']){
  const schema=JSON.stringify(JSON.parse(seo(slug,'Service','Estimate offered').schema));
  assert.doesNotMatch(schema,/priceRange|UnitPriceSpecification|priceSpecification|OfferCatalog|\$45|\$70/);
 }
});
