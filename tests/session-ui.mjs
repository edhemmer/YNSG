// Synthetic session-expiry browser test: no real auth or email provider calls.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const actions=[];const errors=[];let valid=false,unavailable=false;
 const org='20000000-0000-4000-8000-000000000001';
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/session',async route=>{
  if(route.request().method()==='POST'){
   const action=route.request().postDataJSON().action;actions.push(action);
   if(unavailable)return route.fulfill({status:503,json:{error:'Temporary connection failure.'}});
   if(action==='refresh')valid=true;
   if(action==='logout')valid=false;
   return route.fulfill({json:{ok:true}});
  }
  return route.fulfill(valid?{json:{email:'synthetic@example.invalid',memberships:[{organization_id:org,role:'owner'}]}}:{status:401,json:{error:'Sign in to continue.'}});
 });
 await page.route('**/api/workspace?*',route=>route.fulfill({json:{company:{id:org,display_name:'Synthetic business',timezone:'America/Chicago',status:'setup'},requests:[],customers:[],quotes:[],jobs:[],invoices:[],outbox:[],appointments:[],pagination:{page:0,hasMore:false,appointmentFrom:new Date().toISOString()}}}));
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:3011');
 await page.getByRole('button',{name:'More',exact:true}).waitFor();
 assert.deepEqual(actions,['refresh']);
 await page.reload();await page.getByRole('button',{name:'More',exact:true}).waitFor();
 assert.deepEqual(actions,['refresh'],'valid return needs no new sign-in or renewal');
 unavailable=true;valid=false;await page.reload();
 await page.getByRole('button',{name:'Try saved sign-in again'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Email me a sign-in link'}).count(),0,'outage must not prompt another email');
 unavailable=false;
 await page.getByRole('button',{name:'Try saved sign-in again'}).click();
 await page.getByRole('button',{name:'More',exact:true}).waitFor();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByRole('button',{name:'Email me a sign-in link'}).waitFor();
 assert.ok(!actions.includes('send'),'no email requested during renewal or recovery');
 assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS: expired session resumes, valid return stays signed in, outage recovers without email, explicit logout returns to sign-in; mobile layout clean.');
}finally{await browser.close();}
