// Real built account/forms and HTTP auth/profile routes, isolated synthetic providers.
import assert from 'node:assert/strict';
import http from 'node:http';import {spawn} from 'node:child_process';import {resolve} from 'node:path';import {createHash} from 'node:crypto';import {chromium} from 'playwright';
const org='20000000-0000-4000-8000-000000000001',actor='30000000-0000-4000-8000-000000000001',id='40000000-0000-4000-8000-000000000001';
const user={id:actor,email:'synthetic@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:actor,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-only'].join('.');
const session={access_token:jwt,refresh_token:'synthetic-only-refresh',token_type:'bearer',expires_in:3600,user};
let challenge='',signed=false,profile=false,submitted=false,profileCalls=0,signupCalls=0,requestBody='',unknownRequest=false;
const provider=http.createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;const body=raw?JSON.parse(raw):{},url=new URL(req.url,'http://provider.invalid');const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(url.pathname==='/auth/v1/signup'){signupCalls++;challenge=body.code_challenge;return send(200,{user,session:null});}
 if(url.pathname==='/auth/v1/token'){
  if(url.searchParams.get('grant_type')==='pkce'){assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),challenge);signed=true;return send(200,session);}
  if(url.searchParams.get('grant_type')==='password'){signed=true;return send(200,session);}
  if(url.searchParams.get('grant_type')==='refresh_token'){return send(200,session);}
 }
 if(url.pathname==='/auth/v1/user')return send(200,user);
 if(url.pathname==='/auth/v1/logout'){signed=false;return send(200,{});}
 if(url.pathname==='/rest/v1/rpc/create_customer_profile'){assert.equal(req.headers.authorization,'Bearer '+jwt);assert.equal(body.p_org,org);assert.equal(body.p_profile.name,'Synthetic Customer');assert.equal(Object.hasOwn(body.p_profile,'email'),false);profileCalls++;profile=true;return send(200,{organization:org,customer:id,contact:id,property:id});}
 return send(404,{error:'Unsupported synthetic provider path'});
});await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const spare=http.createServer();await new Promise(r=>spare.listen(0,'127.0.0.1',r));const port=spare.address().port;await new Promise(r=>spare.close(r));const origin='http://127.0.0.1:'+port;
const env={...process.env};for(const k of Object.keys(env))if(/^(SUPABASE_|CRM_|GOOGLE_|RESEND_|STRIPE_|APP_ORIGIN$|PUBLIC_SCHEDULING_ORGANIZATION_ID$)/.test(k))delete env[k];Object.assign(env,{NODE_ENV:'production',APP_ORIGIN:origin,SUPABASE_URL:'http://127.0.0.1:'+provider.address().port,SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable',PUBLIC_SCHEDULING_ORGANIZATION_ID:org,NEXT_TELEMETRY_DISABLED:'1'});
const child=spawn(process.execPath,[resolve('apps/web/node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log=(log+b).slice(-2000));child.stderr.on('data',b=>log=(log+b).slice(-2000));let browser;
try{
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(origin+'/account')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,log);
 browser=await chromium.launch({headless:true,...(process.env.YNSG_CHROMIUM_EXECUTABLE?{executablePath:process.env.YNSG_CHROMIUM_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const company={id:org,display_name:'Synthetic Company',timezone:'America/Chicago'};
 await page.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url());const json=(data,status=200)=>route.fulfill({status,json:data});
  if(url.pathname==='/api/session'&&req.method()==='GET')return json({memberships:[]});
  if(url.pathname==='/api/account-link')return json({pending:false});
  if(url.pathname==='/api/portal'){
   if(!signed)return json({error:'Sign in'},401);
   if(!url.search)return json({email:user.email,companies:profile?[company]:[],access:profile?[{organization_id:org,customer_id:id,can_approve:true,can_view_billing:true}]:[]});
   return json({organization:org,company,customers:[{id,display_name:'Synthetic Customer'}],properties:[{id,street:'100 Synthetic Lane',city:'DeKalb',region:'IL',postal_code:'60115'}],requests:submitted?[{id,status:'submitted',created_at:'2026-10-20T14:00:00Z',services:[{service:'Lawn care',task:'Mowing'}]}]:[],jobs:submitted?[{id,status:'completed'}]:[],appointments:submitted?[{id,start_at:'2026-10-27T14:00:00Z',end_at:'2026-10-27T16:00:00Z',arrival_at:null,status:'reserved',timezone:'America/Chicago',customer_response:null}]:[],invoices:submitted?[{id,number:'202610-0001',total_cents:12000,issued_at:'2026-10-20T14:00:00Z',credits:[],payments:[{cents:5000}]}]:[],page:0,hasMore:false});
  }
  if(url.pathname==='/api/account-request'){
   if(req.method()==='GET')return json({contacts:[{id,customer_id:id,name:'Synthetic Customer',email:user.email,phone:'5550000000'}],properties:[{id,customer_id:id,street:'100 Synthetic Lane',city:'DeKalb',region:'IL',postalCode:'60115'}],services:[{name:'Lawn care',scope:'Synthetic lawn scope'}]});
   if(!unknownRequest){requestBody=req.postData();unknownRequest=true;submitted=true;return route.abort();}
   assert.equal(req.postData(),requestBody,'Lost response must replay the exact request');return json({request:{id}});
  }
  if(url.pathname.startsWith('/api/privacy'))return json({error:'No privacy action in this fixture'},401);
  return route.continue();
 });
 console.log('Checking registration');await page.goto(origin+'/account?mode=signup');await page.getByRole('heading',{name:'Create your account',exact:true}).waitFor();await page.getByLabel('Email',{exact:true}).fill(user.email);await page.locator('input[type=password]').fill('synthetic-password');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Check your email',exact:true}).waitFor();assert.equal(signupCalls,1);
 console.log('Checking confirmation');await page.goto(origin+'/auth/confirm?code=synthetic-code');await page.getByRole('heading',{name:'Save your service details',exact:true}).waitFor();
 console.log('Checking profile');const profileForm=page.getByRole('region',{name:'Your service details'});await profileForm.getByLabel('Name',{exact:true}).fill('Synthetic Customer');await profileForm.getByLabel('Phone',{exact:true}).fill('5550000000');await profileForm.getByLabel('Street address',{exact:true}).fill('100 Synthetic Lane');await profileForm.getByLabel('City',{exact:true}).selectOption('DeKalb');await profileForm.getByLabel('ZIP code',{exact:true}).selectOption('60115');await page.getByRole('button',{name:'Save details and continue',exact:true}).click();
 console.log('Checking linked request');await page.getByRole('heading',{name:'Request service appointment',exact:true}).waitFor();assert.equal(profileCalls,1);await page.getByText('Lawn care — Press or click to see jobs',{exact:true}).click();await page.getByLabel('Mowing',{exact:true}).check();await page.getByRole('button',{name:'Send service request',exact:true}).click();await page.getByRole('button',{name:'Check saved request result',exact:true}).waitFor();await page.getByRole('button',{name:'Check saved request result',exact:true}).click();await page.getByText('Your service request is saved. We’ll contact you to confirm the appointment.',{exact:true}).waitFor();
 await page.getByRole('heading',{name:'Service history',exact:true}).waitFor();await page.getByText('Invoice 202610-0001',{exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/70\.00/);assert.match(await page.locator('main').innerText(),/Confirmed/);assert.match(await page.locator('main').innerText(),/completed/);assert.ok(await page.getByRole('link',{name:'Open invoice and download PDF',exact:true}).count());
 for(const width of [320,390,768,1366]){await page.setViewportSize({width,height:844});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Customer account overflow at '+width+' '+theme);}}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/ynsg-customer-account.png',fullPage:true});
 await context.clearCookies({name:'ynsg-access'});await page.reload();await page.getByRole('heading',{name:'Your appointments and service history',exact:true}).waitFor(); // mocked portal history does not invoke refresh; real HTTP refresh verified separately.
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();await page.getByLabel('Email',{exact:true}).fill(user.email);await page.locator('input[type=password]').fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Your appointments and service history',exact:true}).waitFor();assert.equal(profileCalls,1,'Returning login must reuse the original profile');
 assert.deepEqual(errors,[]);console.log('PASS: built customer sign-up → PKCE confirmation → own profile HTTP command → linked request/lost-response replay → status/history/invoice → logout/password sign-in, four widths. Synthetic providers only; no real mail or customer mutations.');
}catch(error){if(browser){const p=browser.contexts()[0]?.pages()[0];if(p){console.error('Observed account:',(await p.locator('body').innerText()).slice(0,1800));console.error('Inputs:',await p.locator('input,label').evaluateAll(es=>es.map(e=>e.outerHTML)));}}throw error;}finally{if(browser)await browser.close();child.kill('SIGTERM');provider.closeAllConnections();await new Promise(r=>provider.close(r));}
