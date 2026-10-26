// Render the actual built public pages with isolated HTTP failures. No real
// messages, slot holds, external providers or production records are used.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist'),output=resolve(process.env.YNSG_PUBLIC_OUTPUT||'/tmp/ynsg-public-review');await mkdir(output,{recursive:true});
const server=http.createServer(async(req,res)=>{
 try{const pathname=new URL(req.url,'http://127.0.0.1').pathname;let file=resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+'/'))throw Error('PATH');if(!extname(file))file=resolve(file,'index.html');
  const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,results=[],errors=[];let browser;
try{
 for(const engine of (process.argv.includes('--chromium-only')?['chromium']:['chromium','webkit'])){
  browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.YNSG_CHROMIUM_EXECUTABLE?{executablePath:process.env.YNSG_CHROMIUM_EXECUTABLE}:{})});
  const paths=['/',...(await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()&&e.name!=='assets').map(e=>'/'+e.name)];
  const cases=[320,390,768,1366].flatMap(width=>paths.flatMap(path=>['light','dark'].map(theme=>({width,path,theme}))));
  cases.push(...paths.map(path=>({width:390,path,theme:'light',largeText:true})));
  for(const {width,path,theme,largeText} of cases.filter(c=>!process.argv.includes('--large-only')||c.largeText)){
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce',colorScheme:theme});page.on('pageerror',e=>errors.push(e.message));let writes=0;
   await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'){writes++;return route.abort();}if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Synthetic provider unavailable'}});return route.continue();});
   const response=await page.goto(origin+path);assert.equal(response.status(),200);await page.locator('h1').waitFor();if(largeText)await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.locator('.site-header .brand img').evaluate(img=>img.decode());
   if(path==='/request')await page.locator('#request-form').waitFor({state:'attached'});
   const state=await page.evaluate(()=>{const img=document.querySelector('.site-header .brand img'),brand=img.getBoundingClientRect(),nav=document.querySelector(innerWidth<=850?'.nav-mobile':'.nav-desktop').getBoundingClientRect(),hero=document.querySelector('main').getBoundingClientRect();return {title:document.title,heading:document.querySelector('h1')?.textContent,logoWidth:brand.width,logoLoaded:img.complete&&img.naturalWidth>0,logoAboveNavigation:brand.bottom<=nav.top+2,navigationAboveMain:nav.bottom<=hero.top+2,overflow:document.documentElement.scrollWidth>innerWidth+1,overflowNodes:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.scrollWidth>e.clientWidth+1).map(e=>({tag:e.tagName,classes:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,client:e.clientWidth,text:e.textContent.slice(0,80)})).slice(0,15)};});
   assert.ok(state.title&&state.heading,'Full public document required');if(state.overflow){console.log({path,width,largeText,nodes:state.overflowNodes});await page.screenshot({path:output+'/overflow.png',fullPage:true});}assert.equal(state.overflow,false,`${engine} ${path} ${width}: horizontal overflow`);assert.equal(state.logoLoaded,true);assert.ok(state.logoWidth>=(width<=850?200:300),`${engine} ${path} ${width}: logo shrunk to ${state.logoWidth}px`);assert.equal(state.logoAboveNavigation,true,'Logo must sit above navigation');assert.equal(state.navigationAboveMain,true,'Navigation must sit above the hero');assert.equal(writes,0,'Page load cannot create a hold or request');
   const buttons=await page.locator('a.service-request-button:visible').evaluateAll(elements=>elements.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {href:e.getAttribute('href'),label:e.textContent,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,font:s.fontSize,padding:s.padding,border:s.borderRadius};}));
   assert.ok(buttons.length,'Every public page needs a request entry');
   for(const button of buttons){assert.equal(button.href,'/request');assert.match(button.label,/Request service appointment/);assert.equal(button.color,'rgb(255, 255, 255)');assert.equal(button.background,'rgb(16, 40, 60)');assert.ok(Math.abs(button.width-Math.min(288,width-100))<1,`${path}: inconsistent request width ${button.width}`);assert.ok(button.height>=52);assert.ok(Math.abs(parseFloat(button.font)-(largeText?32*8/9:16))<.5,`${engine} ${path} ${width} largeText=${Boolean(largeText)}: request font ${button.font}`);assert.equal(button.border,'8px');}
   assert.equal(new Set(buttons.map(b=>b.font)).size,1,'Request button font sizes must agree within the viewport');
   assert.equal(new Set(buttons.map(b=>b.height)).size,1,'Request buttons must agree on height within the viewport');
   assert.ok(await page.locator('a[href="https://yourneighborhoodserviceguy.app/account"]').count(),'Customer sign in is discoverable');
   assert.ok(await page.locator('a[href="https://yourneighborhoodserviceguy.app/account?mode=signup"]').count(),'Customer registration is discoverable');
   if(width===390&&theme==='light'&&!largeText)await page.screenshot({path:output+'/'+engine+(path==='/'?'-home':path.replaceAll('/','-'))+'.png',fullPage:false});
   const primary=page.locator('a.service-request-button:visible').first();await primary.focus();assert.equal(await primary.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(16, 40, 60)','Keyboard focus preserves request color');await primary.hover();await page.waitForFunction(el=>getComputedStyle(el).backgroundColor==='rgb(49, 88, 66)',await primary.elementHandle());assert.equal(await primary.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(49, 88, 66)','Every request hover uses forest');
   await primary.click();await page.waitForURL(origin+'/request');await page.locator('#request-form').waitFor({state:'attached'});
   results.push({engine,width,path,theme,largeText:Boolean(largeText),buttons,...state});await page.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/results.json',JSON.stringify({cases:results.length,results,externalActions:0,uncaughtErrors:errors},null,2));console.log('PASS: '+results.length+' built homepage/booking/local-service masthead and responsive checks; synthetic failures only.');
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
