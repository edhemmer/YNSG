// Synthetic browser contract; never sends real email or requests Google consent.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let claimed=false;const actions=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const org='20000000-0000-4000-8000-000000000001';
 await page.route('**/api/session',r=>r.fulfill({json:{email:'synthetic@example.invalid',memberships:claimed?[{organization_id:org,role:'owner'}]:[]}}));
 await page.route('**/api/owner-setup',r=>{
  if(r.request().method()==='POST'){actions.push('claim');claimed=true;}
  return r.fulfill({json:{eligible:true,claimed,organization:claimed?org:null}});
 });
 await page.route('**/api/mfa',r=>{
  const action=r.request().postDataJSON().action;actions.push(action);
  return r.fulfill({json:action==='prepare'?{factorId:org,enrolled:true}:{ok:true}});
 });
 await page.route('**/api/workspace?*',r=>r.fulfill({json:{company:{id:org,display_name:'Synthetic',timezone:'America/Chicago',status:'setup'},requests:[],customers:[],quotes:[],jobs:[],invoices:[],outbox:[],appointments:[],pagination:{page:0,hasMore:false,appointmentFrom:new Date().toISOString()}}}));
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:3011');
 await page.getByRole('button',{name:'Set up or verify owner authenticator',exact:true}).click();
 await page.getByLabel('Six-digit authenticator code').fill('123456');
 await page.getByRole('button',{name:'Verify and finish owner setup',exact:true}).click();
 await page.getByRole('button',{name:'More',exact:true}).waitFor();
 assert.deepEqual(actions,['prepare','verify','claim']);
 assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS: owner setup requires MFA before claim, reloads membership, and renders on mobile without errors.');
}finally{await browser.close();}
