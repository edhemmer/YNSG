import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ownerFixture,organization,requestId} from '../tests/fixtures/owner-mobile-data.mjs';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('tsx')]}));
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({entryPoints:['tests/fixtures/workspace-browser-harness.tsx'],bundle:true,write:false,nodePaths:[resolve('apps/web/node_modules')],platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const css=readFileSync('apps/web/app/style.css','utf8');
const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const output=resolve(process.env.YNSG_WORKSPACE_OUTPUT||'/tmp/ynsg-workspace-navigation');mkdirSync(output,{recursive:true});
const company2='20000000-0000-4000-8000-000000000002',errors=[],results=[];let browser;
async function mount({role='owner',width=390,path='?section=Requests',theme='light',state='issued'}={}){
 const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'}),fixture=ownerFixture(state),writes=[],reads=[],control={memberships:[{organization_id:organization,role},{organization_id:company2,role:'bookkeeper'}],sessionStatus:200,workspace:null,post:null};
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(theme=>document.addEventListener('DOMContentLoaded',()=>document.documentElement.dataset.theme=theme),theme);
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==origin)throw Error('External request blocked');
  if(!url.pathname.startsWith('/api/'))return route.continue();
  if(req.method()==='POST'){writes.push({path:url.pathname,body:req.postData()});if(control.post)return control.post(route,req,url);return route.fulfill({status:503,json:{error:'Synthetic write unavailable'}});}
  reads.push(url.pathname+url.search);
  if(url.pathname==='/api/session')return route.fulfill({status:control.sessionStatus,json:control.sessionStatus===200?{email:'owner@example.invalid',memberships:control.memberships}:{error:'Sign in required'}});
  if(url.pathname==='/api/workspace'){
   if(control.workspace)return control.workspace(route,url);
   const org=url.searchParams.get('organization');
   return route.fulfill({json:{...fixture.data,brand:null,company:{id:org,display_name:'Synthetic Field Company',timezone:'America/Chicago',status:'active'},customers:[],outbox:[],invoiceAdmin:{},appointments:fixture.data.requests[0].appointments,schedulingPreferences:[],pagination:{page:Number(url.searchParams.get('page')),hasMore:false,appointmentFrom:new Date().toISOString()},features:{productionWorkflows:true}}});
  }
  if(url.pathname==='/api/request-inbox')return route.fulfill({json:fixture.data});
  return route.fulfill({status:503,json:{error:'Synthetic optional data unavailable'}});
 });
 page.setDefaultTimeout(12000);await page.goto(origin+'/owner'+path);await page.locator('#main h1').waitFor();
 return {page,reads,writes,control};
}
async function heading(page,name){await page.locator('#main h1').filter({hasText:name}).waitFor();}
async function go(page,label){
 const dock=page.locator('.crm-mobile-dock');
 if(await dock.isVisible()&&['Today','Requests','Calendar'].includes(label))await dock.getByRole('button',{name:label,exact:true}).click();
 else{if(await dock.isVisible())await dock.getByRole('button',{name:'More workspace tools'}).click();await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:label,exact:true}).click();}
}
async function layout(page,label){
 const failures=await page.evaluate(()=>{
  const fail=[];if(document.documentElement.scrollWidth>innerWidth+1)fail.push('horizontal overflow');
  for(const el of document.querySelectorAll('.money-invoice>summary,.money-tools>summary,.money-pending>summary')){if(!el.getClientRects().length)continue;const r=el.getBoundingClientRect();if(r.height<44||r.left<0||r.right>innerWidth+1)fail.push('invoice summary clipped or too small');}
  for(const el of document.querySelectorAll('.money-invoice>summary>span:first-child'))if(el.getClientRects().length&&el.getBoundingClientRect().width<120)fail.push('invoice identity squeezed into a narrow column');
  for(const el of document.querySelectorAll('.timer-recovery button')){const r=el.getBoundingClientRect();if(r.height<44||r.left<0||r.right>innerWidth+1)fail.push('timer recovery control clipped or too small');}
  return fail;
 });assert.deepEqual(failures,[],label);results.push(label);
}
try{
 for(const engine of (process.argv.includes('--chromium-only')?['chromium']:['chromium','webkit'])){
  browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.YNSG_CHROMIUM_EXECUTABLE?{executablePath:process.env.YNSG_CHROMIUM_EXECUTABLE}:{})});
  {
   const {page,writes,reads}=await mount();
   await heading(page,'Requests');await go(page,'Calendar');await heading(page,'Calendar');await go(page,'Jobs');await heading(page,'Jobs');
   await page.goBack();await heading(page,'Calendar');await page.goBack();await heading(page,'Requests');await page.goForward();await heading(page,'Calendar');await page.goForward();await heading(page,'Jobs');
   assert.equal(new URL(page.url()).searchParams.get('organization'),organization);
   await page.reload();await heading(page,'Jobs');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await heading(page,'Jobs');
   assert.ok(reads.some(s=>s.startsWith('/api/session')));assert.equal(writes.length,0);await page.close();results.push(engine+' full-shell mobile Back/Forward/reload/session focus');
  }
  {
   const {page,control,writes}=await mount({path:'?section=Money&request='+requestId});await heading(page,'Invoices & money');
   assert.equal(new URL(page.url()).searchParams.has('request'),false);
   await page.getByLabel('Switch business').selectOption(company2);await heading(page,'Invoices & money');assert.equal(new URL(page.url()).searchParams.get('organization'),company2);
   await page.goBack();await heading(page,'Invoices & money');assert.equal(new URL(page.url()).searchParams.get('organization'),organization);
   control.memberships=[{organization_id:organization,role:'technician'}];await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await heading(page,'Day routes');assert.equal(await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:'Invoices & money'}).count(),0);
   assert.equal(writes.length,0);await page.close();results.push(engine+' company history and live role revocation');
  }
  {
   const {page,writes,control}=await mount({role:'technician',state:'confirmed',path:'?section=Work'});
   await page.getByRole('button',{name:'Start work',exact:true}).evaluate(button=>{button.click();button.click();});
   await page.getByText('The timer result is unconfirmed.',{exact:false}).waitFor();assert.equal(writes.length,1);
   const first=writes[0].body,command=JSON.parse(first);
   await page.setViewportSize({width:320,height:844});await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' timer recovery 320px 200% text');
   await page.reload();await page.getByRole('button',{name:'Check saved timer action',exact:true}).waitFor();assert.equal(writes.length,1);
   await page.getByRole('button',{name:'Start work',exact:true}).click();assert.equal(writes.length,1);
   control.post=route=>route.fulfill({json:{ok:true,result:{id:command.id,revision:command.revision+1,status:'working'}}});
   await page.getByRole('button',{name:'Check saved timer action',exact:true}).click();await page.getByText('Job and time record saved.',{exact:true}).waitFor();assert.equal(writes.length,2);assert.equal(writes[1].body,first);
   assert.equal(await page.evaluate(()=>sessionStorage.length),0);await page.close();results.push(engine+' durable exact timer retry after reload, duplicate click and blocked alternate action');
  }
  for(const role of ['dispatcher','bookkeeper','technician']){
   const {page,writes}=await mount({role,path:'?section=Settings&request='+requestId+'&customer='+requestId});
   await heading(page,role==='dispatcher'?'Requests':role==='bookkeeper'?'Invoices & money':'Day routes');assert.equal(new URL(page.url()).searchParams.has('request'),false);assert.equal(new URL(page.url()).searchParams.has('customer'),false);assert.equal(writes.length,0);await page.close();
  }results.push(engine+' denied deep links sanitized for all staff roles');
  for(const width of [320,375,390,430,768,1366])for(const theme of ['light','dark']){
   const {page,writes}=await mount({width,theme,path:'?section=Money'});await heading(page,'Invoices & money');
   assert.equal(await page.locator('.money-invoice:not([open])').count(),1);assert.equal(await page.locator('.money-tools[open]').count(),0);
   await layout(page,engine+' money '+width+' '+theme);
   if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-money-closed.png',fullPage:true});
   await page.locator('.money-invoice>summary').click();await page.getByRole('link',{name:'View / print invoice'}).waitFor();await layout(page,engine+' expanded invoice '+width+' '+theme);
   if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-money-normal.png',fullPage:true});
   await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' 200% money '+width+' '+theme);
   assert.equal(writes.length,0);if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-money.png',fullPage:true});await page.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(errors,[]);writeFileSync(output+'/results.json',JSON.stringify({cases:results.length,results,uncaughtErrors:errors,externalActions:0},null,2));console.log('PASS: '+results.length+' full workspace navigation and invoice checks; synthetic API only.');
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
