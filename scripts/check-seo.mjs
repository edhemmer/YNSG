// Audit the rendered output, including every local link and service destination.
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {WEBSITE_ORIGIN,canonicalUrl,localServicePages} from './seo.mjs';

const root=resolve('dist'),pages=new Map(),titles=new Set(),descriptions=new Set();
const slugFor=pathname=>pathname.replace(/^\//,'').replace(/\/$/,'');
async function collect(directory,slug=''){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(entry.isDirectory())await collect(join(directory,entry.name),[slug,entry.name].filter(Boolean).join('/'));
  else if(entry.name==='index.html'){
   const document=new JSDOM(await readFile(join(directory,entry.name),'utf8'),{url:canonicalUrl(slug)}).window.document;
   pages.set(slug,document);
  }
 }
}
await collect(root);
assert.ok(pages.has(''),'Homepage must be built');
const sitemap=new JSDOM(await readFile(join(root,'sitemap.xml'),'utf8'),{contentType:'text/xml'}).window.document;
const locations=[...sitemap.querySelectorAll('loc')].map(node=>node.textContent);
assert.equal(new Set(locations).size,pages.size,'Sitemap must list every built page exactly once');
assert.equal(locations.length,pages.size);
const robots=await readFile(join(root,'robots.txt'),'utf8');
assert.match(robots,/Allow: \/\n/);
assert.ok(robots.includes('Sitemap: '+WEBSITE_ORIGIN+'/sitemap.xml'));
const links=new Map();let linkCount=0;
for(const [slug,document] of pages){
 const url=canonicalUrl(slug),context=slug||'homepage';
 assert.ok(locations.includes(url),context+': missing canonical sitemap URL');
 assert.equal(document.querySelectorAll('link[rel="canonical"]').length,1,context);
 assert.equal(document.querySelector('link[rel="canonical"]').href,url,context);
 assert.equal(document.querySelector('meta[property="og:url"]')?.content,url,context);
 assert.equal(document.querySelectorAll('h1').length,1,context);
 assert.ok(document.querySelector('h1').textContent.trim(),context);
 const title=document.title.trim(),description=document.querySelector('meta[name="description"]')?.content.trim();
 assert.ok(title&&description,context+': missing search metadata');
 assert.ok(!titles.has(title),context+': duplicate title');titles.add(title);
 assert.ok(!descriptions.has(description),context+': duplicate description');descriptions.add(description);
 for(const meta of document.querySelectorAll('meta[name="robots"],meta[name="googlebot"]'))assert.doesNotMatch(meta.content,/noindex|none/i,context);
 const graph=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(node=>JSON.parse(node.textContent)['@graph']||[]);
 const page=graph.find(node=>node['@type']==='WebPage');assert.equal(page?.url,url,context);
 const ids=new Set(graph.map(node=>node['@id']));assert.equal(ids.size,graph.length,context+': duplicate schema IDs');
 if(slug){const crumb=graph.find(node=>node['@id']===page.breadcrumb?.['@id']);assert.equal(crumb?.itemListElement.at(-1).item,url,context);}
 if(localServicePages[slug]){
  const service=graph.find(node=>node['@id']===page.mainEntity?.['@id']);
  assert.equal(service?.['@type'],'Service',context+': missing primary service');
  assert.equal(service.url,url,context);assert.equal(service.areaServed.length,3,context);
  assert.ok(ids.has(service.provider['@id']),context+': unresolved provider');
  assert.ok(document.querySelector('main a[href^="/pricing"]'),context+': missing pricing guidance');
 }
 const destinations=new Set();
 for(const anchor of document.querySelectorAll('a[href]')){
  const destination=new URL(anchor.href,url);if(destination.origin!==WEBSITE_ORIGIN)continue;
  const target=slugFor(destination.pathname),targetPage=pages.get(target);linkCount++;
  if(targetPage){
   // Every crawlable page link should resolve to the same URL published in our sitemap.
   // Avoid splitting discovery signals across /service and /service/ variants.
   assert.equal(destination.pathname,new URL(canonicalUrl(target)).pathname,context+': non-canonical internal page link '+anchor.getAttribute('href'));
   destinations.add(target);
   if(destination.hash)assert.ok(targetPage.getElementById(decodeURIComponent(destination.hash.slice(1))),context+': broken fragment '+anchor.getAttribute('href'));
  }else{
   const asset=resolve(root,'.'+destination.pathname);assert.ok(asset.startsWith(root+'/'),context+': unsafe link');
   await access(asset).catch(()=>assert.fail(context+': broken local link '+anchor.getAttribute('href')));
  }
 }
 links.set(slug,destinations);
}
const reachable=new Set(),queue=[''];
while(queue.length){const slug=queue.shift();if(reachable.has(slug))continue;reachable.add(slug);queue.push(...links.get(slug));}
for(const slug of pages.keys())assert.ok(reachable.has(slug),slug+': orphan page');
for(const slug of Object.keys(localServicePages))assert.ok(pages.has(slug),slug+': service page not built');
console.log(`PASS: ${pages.size} public pages, ${linkCount} local links, unique metadata, canonical sitemap, schema and reachable service pages.`);
