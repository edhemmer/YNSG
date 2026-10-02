// Browser contract test with synthetic API responses; does not verify live OAuth.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const org='20000000-0000-4000-8000-000000000001';let connection=null;const actions=[];
 await page.route('**/api/session',r=>r.fulfill({json:{email:'synthetic@example.invalid',memberships:[{organization_id:org,role:'owner'}]}}));
 await page.route('**/api/workspace?*',r=>r.fulfill({json:{company:{id:org,display_name:'Synthetic test company',timezone:'America/Chicago',status:'setup'},requests:[],customers:[],quotes:[],jobs:[],invoices:[],outbox:[],appointments:[],pagination:{page:0,hasMore:false,appointmentFrom:new Date().toISOString()}}}));
 await page.route('**/api/google*',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{missing:[],redirectUri:'https://synthetic.example.invalid/api/google/callback',connection}});
  const value=r.request().postDataJSON();actions.push(value.action);assert.equal(value.organization,org);
  if(value.action==='calendars')return r.fulfill({json:{calendars:[{id:'mine',summary:'YNSG test calendar',timeZone:'America/Chicago'}]}});
  if(value.action==='calendar')connection={...connection,calendarId:value.calendarId};
  if(value.action==='health')connection={...connection,health:'healthy',checkedAt:new Date().toISOString()};
  if(value.action==='test_email')connection={...connection,gmailTest:'accepted'};
  if(value.action==='disconnect'){connection=null;return r.fulfill({json:{revoked:true}});}
  return r.fulfill({json:{connection}});
 });
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:3011');await page.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('button',{name:'Connect Google',exact:true}).waitFor();
 connection={connected:true,email:'synthetic@example.invalid',calendarId:null,health:'connected',checkedAt:null,gmailTest:'not_tested'};
 await page.getByRole('button',{name:'Refresh status',exact:true}).click();
 await page.getByRole('button',{name:'Load my calendars',exact:true}).click();await page.getByLabel('Calendar you own').selectOption('mine');await page.getByRole('button',{name:'Save calendar',exact:true}).click();
 await page.getByRole('button',{name:'Check connection',exact:true}).click();await page.getByText('Connection checked.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Send Gmail test to myself',exact:true}).click();await page.getByText('Google accepted the test message.',{exact:false}).waitFor();
 await page.getByText('Disconnect Google',{exact:true}).click();await page.getByRole('button',{name:'Disconnect this account',exact:true}).click();await page.getByRole('button',{name:'Connect Google',exact:true}).waitFor();
 assert.deepEqual(actions,['calendars','calendar','health','test_email','disconnect']);assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout must not overflow');
 console.log('PASS: synthetic mobile Google controls, calendar selection, health, test email, disconnect; no browser errors. Live Google consent remains unverified.');
}finally{await browser.close();}
