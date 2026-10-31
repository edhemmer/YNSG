// Real connected field components and isolated sample store, with all external traffic blocked.
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('tsx')]}));
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({entryPoints:['tests/fixtures/field-system-browser-harness.tsx'],bundle:true,write:false,nodePaths:[resolve('apps/web/node_modules')],platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const css=readFileSync('apps/web/app/style.css','utf8');
const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const output=resolve(process.env.YNSG_FIELD_OUTPUT||'/tmp/ynsg-field-system');mkdirSync(output,{recursive:true});
let browser;const results=[],errors=[];
async function layout(page,label){
 const findings=await page.evaluate(()=>{const bad=[];if(document.documentElement.scrollWidth>innerWidth+1)bad.push('page overflow');for(const el of document.querySelectorAll('.field-job button,.field-job a.button,.field-job summary,.field-job input:not([type=checkbox]),.field-job select,.field-job textarea')){if(!el.getClientRects().length||!el.checkVisibility())continue;const r=el.getBoundingClientRect();if(r.width<1||r.height<44)bad.push('small control '+el.textContent.slice(0,30));if(r.left<0||r.right>innerWidth+1)bad.push('clipped control '+el.textContent.slice(0,30));}return bad;});assert.deepEqual(findings,[],label);results.push(label);
}
try{
 for(const engine of(process.argv.includes('--chromium-only')?['chromium']:['chromium','webkit'])){
  browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.YNSG_CHROMIUM_EXECUTABLE?{executablePath:process.env.YNSG_CHROMIUM_EXECUTABLE}:{})});
  for(const width of [320,390,768,1366])for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(12000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
   await page.addInitScript(theme=>document.addEventListener('DOMContentLoaded',()=>document.documentElement.dataset.theme=theme),theme);
   await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin||url.pathname.startsWith('/api/'))throw Error('Unexpected network request: '+url.pathname);return route.continue();});
   await page.goto(origin+'/owner/practice');await page.locator('.request-summary-card').first().waitFor();
   const card=page.locator('.request-summary-card').filter({hasText:'Sample — New request'});await card.getByRole('button',{name:/^Continue workflow/}).click();
   const job=page.locator('.field-job');await job.getByRole('button',{name:'Confirm appointment',exact:true}).waitFor();assert.equal(await job.getByRole('button',{name:/Start work|Record received payment|Approve and issue invoice/}).count(),0);
   await layout(page,engine+' '+width+' '+theme+' pending decision');if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-pending.png',fullPage:true});
   await job.getByRole('button',{name:'Confirm appointment',exact:true}).click();
   const select=job.locator('select[name="visitTime"]');await select.locator('option[value]:not([value=""])').first().waitFor({state:'attached'});const start=await select.locator('option[value]:not([value=""])').first().getAttribute('value');await select.selectOption(start);
   await job.getByRole('button',{name:'Schedule appointment',exact:true}).click();await job.getByRole('button',{name:'Save labor estimate',exact:true}).waitFor();assert.equal(await job.getByRole('button',{name:'Start work',exact:true}).count(),0);
   await job.getByRole('button',{name:'Save labor estimate',exact:true}).click();await job.getByRole('button',{name:'Agreed by text or email',exact:true}).click();assert.match(await job.locator('textarea[name="evidence"]').inputValue(),/text or email/);await job.locator('textarea[name="evidence"]').fill('Practice only: fictional customer agreed to the saved work and amount.');await job.getByRole('button',{name:'Record customer agreement',exact:true}).click();
   await job.getByRole('button',{name:'Start work',exact:true}).click();await job.getByRole('button',{name:'Pause timer',exact:true}).click();await job.getByRole('button',{name:'Resume timer',exact:true}).click();await job.getByRole('button',{name:'Pause timer',exact:true}).waitFor();
   assert.equal(await job.getByRole('button',{name:'Start work',exact:true}).count(),0);await layout(page,engine+' '+width+' '+theme+' running job');if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-working.png',fullPage:true});
   await job.getByRole('button',{name:'Finish work',exact:true}).click();await job.getByLabel('Actual minutes recorded',{exact:true}).fill('120');await job.getByLabel('The work is finished. I reviewed the actual work, minutes and agreed labor charges.',{exact:false}).check();await job.getByRole('button',{name:'Save work & complete visit',exact:true}).click();
   await job.getByRole('button',{name:'Approve and issue invoice',exact:true}).waitFor();await layout(page,engine+' '+width+' '+theme+' completed invoice review');if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-invoice.png',fullPage:true});
   await job.getByRole('button',{name:'Approve and issue invoice',exact:true}).click();await job.getByLabel('Amount received (USD)',{exact:true}).waitFor();assert.equal(await job.locator('.mobile-work-record').count(),0);await layout(page,engine+' '+width+' '+theme+' receipt');
   await job.getByLabel('Amount received (USD)',{exact:true}).fill('50.00');await job.getByLabel('Cash note or Zelle confirmation reference (no bank or account numbers)',{exact:true}).fill('Synthetic cash received in practice');await job.getByLabel('I confirmed the money was received.',{exact:true}).check();await job.getByRole('button',{name:'Record received payment',exact:true}).click();
   await job.locator('.payment-balance-summary').getByText('$70.00',{exact:true}).waitFor();assert.equal(await job.getByRole('heading',{name:'Closed out',exact:true}).count(),0);
   await job.getByLabel('Amount received (USD)',{exact:true}).fill('70.00');await job.locator('select[name=method]').selectOption('zelle');await job.getByLabel('Cash note or Zelle confirmation reference (no bank or account numbers)',{exact:true}).fill('Synthetic Zelle receipt in practice');await job.getByLabel('I confirmed the money was received.',{exact:true}).check();await job.getByRole('button',{name:'Record received payment',exact:true}).click();await job.getByRole('heading',{name:'Closed out',exact:true}).waitFor();
   await job.getByText('No payment remains due.',{exact:true}).waitFor();assert.equal(await job.getByRole('button',{name:'Record received payment',exact:true}).count(),0);await layout(page,engine+' '+width+' '+theme+' settled');
   await page.addStyleTag({content:'html{font-size:32px!important}'});await layout(page,engine+' '+width+' '+theme+' settled 200% text');
   if(width===390&&theme==='light')await page.screenshot({path:output+'/'+engine+'-closed.png',fullPage:true});
   await job.locator('summary').filter({hasText:'Email invoice & PDF'}).click();await job.getByRole('link',{name:'Open invoice / download PDF',exact:true}).click();await page.getByText('SAMPLE',{exact:false}).first().waitFor();assert.ok(await page.getByRole('button',{name:'Back to sample visit',exact:true}).isVisible());results.push(engine+' '+width+' '+theme+' complete request → schedule → agreement → timer → work → issue → partial cash → Zelle → saved document');await page.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(errors,[]);writeFileSync(output+'/results.json',JSON.stringify({cases:results.length,results,errors,externalActions:0},null,2));console.log('PASS: '+results.length+' field system journey and layout checks; synthetic store only.');
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
