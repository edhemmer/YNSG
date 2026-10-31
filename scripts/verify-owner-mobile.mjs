// Actual React components + production stylesheet; only isolated synthetic API responses.
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ownerFixture,scheduleContext,visitId,resource} from '../tests/fixtures/owner-mobile-data.mjs';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('tsx')]}));
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({entryPoints:['tests/fixtures/owner-mobile-harness.tsx'],bundle:true,write:false,nodePaths:[resolve('apps/web/node_modules')],platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const css=readFileSync('apps/web/app/style.css','utf8');
const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
await new Promise(r=>server.listen(Number(process.env.YNSG_BROWSER_PORT||0),'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const output=resolve(process.env.YNSG_BROWSER_OUTPUT||'/tmp/ynsg-owner-mobile');mkdirSync(output,{recursive:true});
const results=[],errors=[];let browser;
async function mount(state='new',width=390,theme='light',mode='detail',engine='chromium'){
 const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'}),fixture={...ownerFixture(state),mode},writes=[],controls={post:null};
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(({fixture,theme})=>{window.__ownerFixture=fixture;document.addEventListener('DOMContentLoaded',()=>document.documentElement.dataset.theme=theme);},{fixture,theme});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==origin)throw Error('External request blocked: '+url.origin);
  if(!url.pathname.startsWith('/api/'))return route.continue();
  if(req.method()==='POST'){writes.push({path:url.pathname,body:req.postData()});if(controls.post)return controls.post(route,req,url);return route.fulfill({status:503,json:{error:'Synthetic unconfirmed write'}});}
  if(url.pathname==='/api/request-inbox')return route.fulfill({json:fixture.data});
  if(url.pathname==='/api/scheduling-review')return route.fulfill({json:{...scheduleContext,...(url.searchParams.has('appointment')?{appointment:fixture.data.requests[0].appointments[0],appointmentResources:[resource]}:{})}});
  if(url.pathname==='/api/availability')return route.fulfill({json:{reserved:false,timezone:'America/Chicago',validUntil:new Date(Date.now()+60000).toISOString(),times:[{start:(url.searchParams.get('day')||'2099-10-19')+'T14:00:00Z'}]}});
  if(url.pathname==='/api/invoice-draft')return route.fulfill({json:{draft:null,tax:{required:false,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}}});
  return route.fulfill({status:503,json:{error:'Synthetic optional record unavailable'}});
 });
 page.setDefaultTimeout(10000);await page.goto(origin+'/owner',{timeout:10000});await page.getByRole(mode==='detail'?'dialog':'main').waitFor();if(mode==='detail')await page.getByRole('heading',{name:'Morgan Synthetic Neighbor'}).waitFor();
 return {page,fixture,writes,controls,engine};
}
async function layout(page,label){
 const failures=await page.evaluate(()=>{
  const root=document.querySelector('dialog[open]')||document.querySelector('main'),width=innerWidth,failures=[];
  if(document.documentElement.scrollWidth>width+1)failures.push('page overflow');
  if(root.scrollWidth>root.clientWidth+1)failures.push('content overflow');
  // Closed details retain layout boxes in some engines; only painted controls can overlap.
  const controls=[...root.querySelectorAll('button,input,textarea,select,a.button')].filter(e=>e.getClientRects().length&&e.checkVisibility());
  for(const el of controls){const r=el.getBoundingClientRect(),parent=root.getBoundingClientRect();if(r.left<parent.left-1||r.right>parent.right+1)failures.push('clipped '+el.textContent.slice(0,45));const target=el.matches('input[type=checkbox],input[type=radio]')?el.closest('label')?.getBoundingClientRect():r;if(target&&target.height<43)failures.push('small target '+el.tagName+' '+el.type+' '+el.textContent.slice(0,45));}
  const buttons=controls.filter(e=>e.matches('button,a.button'));for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i].getBoundingClientRect(),b=buttons[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)failures.push('overlapping buttons: '+buttons[i].textContent.trim()+' / '+buttons[j].textContent.trim());}
  return failures;
 });assert.deepEqual(failures,[],label+': '+failures.join(', '));results.push(label);
}
try{
 for(const engine of (process.argv.includes('--chromium-only')?['chromium']:['chromium','webkit'])){
  const type=engine==='webkit'?webkit:chromium;
  browser=await type.launch({headless:true,timeout:20000,...(engine==='chromium'&&process.env.YNSG_CHROMIUM_EXECUTABLE?{executablePath:process.env.YNSG_CHROMIUM_EXECUTABLE}:{})});
  console.log('Browser ready: '+engine);
  for(const width of (process.argv.includes('--interactions-only')?[]:[320,375,390,430,768,1366]))for(const theme of ['light','dark'])for(const state of ['new','proposal','retained','confirmed','working','completed','issued','paid','declined','canceled']){
   const {page,writes}=await mount(state,width,theme,'detail',engine);
   await layout(page,`${engine} ${width} ${theme} ${state}`);
   if(['new','proposal'].includes(state)){
    assert.equal(await page.getByRole('button',{name:'Confirm appointment',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Decline request',exact:true}).count(),1);
    assert.equal(await page.locator('.scheduled-invoice,.linked-records,.workflow-strip').count(),0);
    assert.equal(await page.getByRole('button',{name:/invoice|timer|close out|complete visit/i}).count(),0);
   }
   assert.equal(writes.length,0);
   if(width===390&&theme==='light'&&['new','confirmed','completed'].includes(state))await page.screenshot({path:output+'/'+engine+'-'+state+'.png',fullPage:true});
   await page.close();
  }
  // Inbox confirmation opens scheduling directly, without a preliminary status write.
  {
   const {page,writes}=await mount('new',390,'light','quick');await page.getByRole('button',{name:'Confirm appointment',exact:true}).click();await page.locator('select[name="visitTime"]').waitFor();assert.equal(writes.length,0);await layout(page,engine+' inbox direct scheduling');await page.close();
  }
  // Jobs entry obeys the same saved milestones and has a direct decline route.
  for(const width of [320,390,768])for(const state of ['new','retained','confirmed','working','completed','issued','paid','canceled']){
   const {page}=await mount(state,width,'light','work');await page.getByRole('heading',{name:'Morgan Synthetic Neighbor'}).waitFor();await layout(page,engine+' workflow '+width+' '+state);
   if(state==='new'){assert.equal(await page.getByRole('button',{name:/Start work timer|Save work|Approve and issue invoice|Record received payment/}).count(),0);await page.getByRole('button',{name:'Decline request',exact:true}).click();await page.locator('.decline-fields select').last().waitFor();}
    if(state==='retained'){assert.equal(await page.getByRole('button',{name:'Decline request',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Confirm appointment',exact:true}).count(),0);assert.match(await page.locator('[aria-label="Current field action"]').innerText(),/Review payments/);assert.equal(await page.getByRole('link',{name:'Review payments'}).count(),1);}
   if(['issued','paid'].includes(state)){for(const summary of await page.locator('.field-job details:not([open]) > summary').all())if(await summary.isVisible())await summary.click();await layout(page,engine+' expanded workflow '+width+' '+state);}
   await page.close();
  }
  // Editable, branded decline and exact replay after an interrupted response.
  {
   const {page,writes,controls}=await mount('new');await page.getByRole('button',{name:'Decline request',exact:true}).click();
   await page.locator('.decline-fields select').last().selectOption('service');await page.getByLabel('Message for the customer').fill('Synthetic custom explanation. Please keep me in mind for a future project.');
   await page.getByText('Included signature',{exact:true}).click();assert.match(await page.locator('form.decision-form').innerText(),/Ed Hemmer/);assert.equal(writes.length,0);
   await page.setViewportSize({width:320,height:400});await page.getByLabel('Message for the customer').focus();await layout(page,engine+' keyboard-sized decline');
   await page.getByRole('button',{name:'Approve decline & send message'}).click();await page.getByRole('button',{name:'Check saved action result'}).waitFor();
   assert.equal(writes.length,1);assert.equal(await page.locator('.decline-fields textarea').isDisabled(),true);
   controls.post=route=>route.fulfill({json:{ok:true,result:{id:'50000000-0000-4000-8000-000000000001',status:'declined',revision:4}}});await page.getByRole('button',{name:'Check saved action result'}).click();await page.waitForTimeout(100);assert.equal(writes.length,2);assert.equal(writes[0].body,writes[1].body);await page.close();
  }
  // Opening confirmation does not write status; alternate-time flow is deliberate.
  {
   const {page,writes,controls,fixture}=await mount('new');await page.getByRole('button',{name:'Confirm appointment',exact:true}).click();await page.locator('select[name="visitTime"]').waitFor();assert.equal(writes.length,0);await layout(page,engine+' scheduling');
   await page.waitForFunction(()=>document.querySelector('select[name="visitTime"]').options.length>1);
   const option=await page.locator('select[name="visitTime"] option').nth(1).getAttribute('value');await page.locator('select[name="visitTime"]').selectOption(option);
   controls.post=(route,req,url)=>{assert.equal(url.pathname,'/api/scheduling-review');fixture.data.requests[0].appointments=ownerFixture('confirmed').data.requests[0].appointments;return route.fulfill({json:{ok:true,result:{id:visitId,status:'reserved',revision:3},delivery:null}});};
   await page.getByRole('button',{name:'Schedule appointment',exact:true}).click();await page.getByRole('button',{name:'Prepare work & price',exact:true}).waitFor();assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0].body).confirmImmediately,true);assert.equal(await page.getByLabel('Service radius advisory').count(),0);await page.getByRole('button',{name:'Prepare work & price',exact:true}).click();await page.getByRole('link',{name:'Review work & customer approval',exact:true}).click();await page.locator('#field-customer-agreement').waitFor();assert.equal(writes.length,1);await page.close();
  }
  {
   const {page,writes}=await mount('proposal');await page.getByRole('button',{name:'Choose another time',exact:true}).click();await page.locator('.decline-fields select').last().selectOption('time');assert.equal(writes.length,0);await layout(page,engine+' alternate-time approval');await page.close();
  }
  // Enlarged text and orientation change retain usable flow.
  {
   const {page}=await mount('new',320);await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' 200% text');await page.setViewportSize({width:844,height:390});await layout(page,engine+' landscape');await page.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(errors,[]);writeFileSync(output+'/results.json',JSON.stringify({cases:results.length,results,uncaughtErrors:errors,externalActions:0},null,2));
 console.log('PASS: '+results.length+' mobile drawer layout/interaction checks; synthetic API only; screenshots: '+output);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
