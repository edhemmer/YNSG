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
async function mount({role='owner',width=390,path='?section=Requests',theme='light',state='issued',routeStops=1}={}){
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
  if(url.pathname==='/api/owner-day')return route.fulfill({json:{checkedAt:new Date().toISOString(),timezone:'America/Chicago',hasMore:false,calls:Array.from({length:routeStops},(_,i)=>fixture.data.requests[0].appointments.filter(a=>a.status==='reserved').map(a=>({id:a.id,requestId:requestId,startAt:a.start_at,arrivalAt:a.arrival_at||a.start_at,endAt:a.end_at,name:fixture.data.requests[0].original_submission.name,address:'100 Synthetic Street, DeKalb',phone:'5550100999',tasks:['Furniture assembly']})).map(c=>({...c,id:c.id.slice(0,-2)+String(i+1).padStart(2,'0'),name:routeStops===1?c.name:c.name+' '+(i+1),address:(100+i)+' Synthetic Street, DeKalb'}))).flat()}});
  if(url.pathname==='/api/owner-work')return route.fulfill({json:{checkedAt:new Date().toISOString(),page:0,total:fixture.data.jobs.length,hasMore:false,items:fixture.data.jobs.filter(j=>['working','paused','completed'].includes(j.status)&&!fixture.data.invoices.some(i=>i.job_id===j.id)).map(j=>({job:j.id,request:requestId,name:fixture.data.requests[0].original_submission.name,address:'100 Synthetic Street, DeKalb',tasks:['Furniture assembly'],status:j.status}))}});
  if(url.pathname==='/api/request-inbox')return route.fulfill({json:fixture.data});
  return route.fulfill({status:503,json:{error:'Synthetic optional data unavailable'}});
 });
 page.setDefaultTimeout(12000);await page.goto(origin+'/owner'+path);await page.locator('#main h1').waitFor();
 return {page,reads,writes,control};
}
async function heading(page,name){await page.locator('#main h1').filter({hasText:name}).waitFor();}
async function go(page,label){
 const dock=page.locator('.crm-mobile-dock');
 if(await dock.isVisible()&&['Today','Requests','Jobs'].includes(label))await dock.getByRole('button',{name:label,exact:true}).click();
 else{if(await dock.isVisible())await dock.getByRole('button',{name:'More workspace tools'}).click();const nav=page.getByRole('navigation',{name:'Workspace',exact:true}),target=nav.getByRole('button',{name:label,exact:true});if(!await target.isVisible())await nav.locator('.sidebar-more>summary').click();await target.click();}
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
  {
   const {page,reads,writes}=await mount({path:'?section=Money'});
   const expense=page.locator('.money-tools').filter({has:page.locator('summary').filter({hasText:'Expenses & cash activity'})});
   const mileage=page.locator('.money-tools').filter({has:page.locator('summary').filter({hasText:'Mileage & trips'})});
   assert.equal(reads.filter(path=>/^\/api\/(finance-activity|mileage)\?/.test(path)).length,0);
   assert.equal(await expense.locator('input').count(),0);assert.equal(await mileage.locator('input').count(),0);
   await expense.locator(':scope > summary').click();await expense.getByText('Record a paid business expense',{exact:true}).click();await expense.getByLabel('Vendor',{exact:true}).fill('Synthetic retained draft');
   const expenseReads=reads.filter(path=>path.startsWith('/api/finance-activity?')).length;assert.equal(expenseReads,1);
   await expense.locator(':scope > summary').click();
   page.once('dialog',dialog=>dialog.dismiss());await go(page,'Requests');await heading(page,'Invoices & money');
   await expense.locator(':scope > summary').click();assert.equal(await expense.getByLabel('Vendor',{exact:true}).inputValue(),'Synthetic retained draft');
   assert.equal(reads.filter(path=>path.startsWith('/api/finance-activity?')).length,expenseReads);
   assert.equal(reads.filter(path=>path.startsWith('/api/mileage?')).length,0);
   page.once('dialog',dialog=>dialog.accept());await page.getByLabel('Switch business').selectOption(company2);await heading(page,'Invoices & money');
   assert.equal(await page.locator('.money-tools input').count(),0);
   assert.equal(writes.length,0);await page.close();results.push(engine+' tools defer reads, retain collapsed drafts and guard company/navigation changes');
  }
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
  for(const width of [320,375,390,430,768,1366])for(const theme of ['light','dark']){
   const {page,reads,writes}=await mount({width,theme,state:'working',path:'?section=Dashboard'});await heading(page,'Today');await page.getByRole('button',{name:'Continue job',exact:true}).waitFor();
   assert.equal(await page.locator('.marketing-assistant,.metric-grid,.business-brief').count(),0);assert.equal(reads.filter(p=>p.startsWith('/api/business-snapshot')).length,0);assert.equal(await page.locator('.field-desk h2').filter({hasText:'Morgan Synthetic Neighbor'}).count(),1);
   await layout(page,engine+' field desk '+width+' '+theme);if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-field-desk.png',fullPage:true});
   await page.getByLabel('Find in your work queue').fill('morgan assembly');
   await page.getByRole('status').filter({hasText:'2 matches in the loaded queue'}).waitFor();
   assert.equal(await page.locator('[aria-label="Matching work"] .field-queue-row').count(),2);
   await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' finder 200% '+width+' '+theme);
   await page.getByLabel('Find in your work queue').fill('no matching customer');await page.getByRole('status').filter({hasText:'0 matches'}).waitFor();
   await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByRole('button',{name:'Continue job',exact:true}).waitFor();
   await page.addStyleTag({content:'html{font-size:16px!important}'});
   await page.getByLabel('Find in your work queue').fill('morgan assembly');
   await page.locator('[aria-label="Matching work"] .field-queue-row').filter({hasText:'Working job'}).click();await heading(page,'Job');assert.equal(await page.locator('.mobile-workflow-steps').count(),0);assert.equal(await page.locator('.field-job .field-job-service').count(),1);const brief=page.getByRole('region',{name:'Agreed work brief'});await brief.waitFor();assert.match(await brief.textContent(),/Assemble a small bookcase/);assert.match(await brief.textContent(),/Labor estimate/);await layout(page,engine+' one field job '+width+' '+theme);await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' agreed work 200% '+width+' '+theme);await page.addStyleTag({content:'html{font-size:16px!important}'});if(width===390&&theme==='light')await page.locator('.field-job').screenshot({path:output+'/'+engine+'-field-job.png'});
   await go(page,'Marketing');await heading(page,'Marketing');await page.locator('.marketing-assistant').waitFor();assert.equal(await page.locator('.field-desk,.field-job').count(),0);assert.equal(writes.length,0);await page.close();
  }
  for(const width of [320,375,390,430,768,1366])for(const theme of ['light','dark']){
   const {page,writes}=await mount({width,theme,state:'new',path:'?section=Dashboard'});await heading(page,'Today');
   await page.getByLabel('Find in your work queue').fill('fictional dekalb reviewing');
   const match=page.locator('[aria-label="Matching work"] .field-queue-row');await match.waitFor();assert.match(await match.textContent(),/100 Fictional Lane.*DeKalb/);
   await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' pending address finder '+width+' '+theme);
   if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-request-finder.png',fullPage:true});
   await match.click();await heading(page,'Job');await page.getByRole('button',{name:'Confirm appointment',exact:true}).waitFor();assert.equal(writes.length,0);await page.close();
  }
  for(const width of [320,375,390,430,768,1366])for(const theme of ['light','dark']){
   const {page,writes}=await mount({width,theme,state:'working',path:'?section=Today',routeStops:5});await page.locator('.owner-upcoming-stops summary').click();
   assert.equal(await page.locator('.owner-upcoming-stops article').count(),4);const last=page.locator('.owner-upcoming-stops article').last();assert.match(await last.textContent(),/104 Synthetic Street/);assert.match(await last.textContent(),/Oct 19/);assert.equal(await last.getByRole('link',{name:/Call/}).count(),1);
   await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' full day route '+width+' '+theme);if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-day-route.png',fullPage:true});
   await last.getByRole('button',{name:'Open job'}).click();await heading(page,'Job');assert.equal(writes.length,0);await page.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(errors,[]);writeFileSync(output+'/results.json',JSON.stringify({cases:results.length,results,uncaughtErrors:errors,externalActions:0},null,2));console.log('PASS: '+results.length+' full workspace navigation and invoice checks; synthetic API only.');
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
