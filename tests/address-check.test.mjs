import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {addressInput,checkAddress} from '../lib/address-check.js';
import {addressCheck} from '../site/address-check.js';
import handler from '../api/address-check.js';
const input={street:'100 Synthetic Rd Apt 2',city:'DeKalb',state:'IL'};
const match={matchedAddress:'100 SYNTHETIC RD, DEKALB, IL, 60115',addressComponents:{city:'DEKALB',state:'IL',zip:'60115'},coordinates:{x:1,y:1},private:'must not escape'};
const response=data=>new Response(JSON.stringify(data),{status:200});
test('Census checks only address fields, preserves units as unverified, strips extra provider data and never changes house numbers',async()=>{
 let sent;const value=await checkAddress(input,async(url,options)=>{sent=new URL(url);assert.equal(options.redirect,'error');assert.ok(options.signal);return response({result:{addressMatches:[match]}});});
 assert.equal(sent.origin,'https://geocoding.geo.census.gov');assert.equal(sent.searchParams.get('street'),'100 Synthetic Rd');assert.equal(sent.searchParams.get('benchmark'),'Public_AR_Current');assert.equal(value.status,'match');assert.equal(value.unitChecked,false);assert.equal(value.candidates[0].street,'100 SYNTHETIC RD Apt 2');assert.ok(!JSON.stringify(value).includes('coordinates'));
 assert.equal((await checkAddress(input,async()=>response({result:{addressMatches:[{...match,matchedAddress:'101 SYNTHETIC RD, DEKALB, IL, 60115'}]}}))).status,'no_match');
});
test('malformed inputs never call the provider; outages, bad JSON, no match and ambiguity remain distinct',async()=>{
 let calls=0;for(const raw of [{...input,email:'never@example.invalid'},{...input,street:'<script>'},{...input,state:'ZZ'},{...input,postalCode:'bad'}])await assert.rejects(()=>checkAddress(raw,async()=>calls++));assert.equal(calls,0);
 assert.equal((await checkAddress(input,async()=>{throw Error('timeout');})).status,'unavailable');
 assert.equal((await checkAddress(input,async()=>new Response('not JSON'))).status,'unavailable');
 assert.equal((await checkAddress(input,async()=>response({result:{addressMatches:[]}}))).status,'no_match');
 assert.equal((await checkAddress(input,async()=>response({result:{addressMatches:[match,{...match,matchedAddress:'100 SYNTHETIC AVE, DEKALB, IL, 60115'}]}}))).status,'multiple');
 assert.deepEqual(addressInput({...input,postalCode:'60115-1234'}),{...input,postalCode:'60115-1234'});
});
const html=readFileSync(new URL('../site/pages/form.html',import.meta.url),'utf8'),tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(transport){const dom=new JSDOM(html,{url:'https://example.invalid/request'}),form=dom.window.document.querySelector('form');form.querySelector('#street').value=input.street;form.querySelector('#city').value=input.city;addressCheck(form,transport);return {dom,form,click:()=>form.querySelector('#address-check').click(),result:()=>form.querySelector('#address-check-result')};}
test('address check is explicit, applies only a deliberate choice and keeps the supported city and unit',async()=>{
 let calls=0;const h=harness(async(path,options)=>{calls++;assert.equal(path,'/api/address-check');assert.deepEqual(JSON.parse(options.body),input);return response({status:'match',candidates:[{street:'100 SYNTHETIC RD Apt 2',city:'DEKALB',state:'IL',postalCode:'60115'}]});});assert.equal(calls,0);h.click();await tick();assert.equal(h.form.querySelector('#street').value,input.street);assert.match(h.result().textContent,/Street match found/);h.result().querySelector('button').click();assert.equal(h.form.querySelector('#street').value,'100 SYNTHETIC RD Apt 2');assert.equal(h.form.querySelector('#city').value,'DeKalb');h.dom.window.close();
});
test('changed addresses discard delayed results and uncertain submission prevents applying an earlier result',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.click();h.form.querySelector('#street').value='200 Changed Street';h.form.querySelector('#street').dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));resolve(response({status:'match',candidates:[{street:'100 OLD RD',city:'DEKALB',state:'IL'}]}));await tick();assert.equal(h.result().textContent,'');assert.equal(h.form.querySelector('#address-check').disabled,false);h.dom.window.close();
 const k=harness(async()=>response({status:'match',candidates:[{street:'100 NEW RD',city:'DEKALB',state:'IL'}]}));k.click();await tick();k.form.dataset.deliveryUnknown='true';k.result().querySelector('button').click();assert.equal(k.form.querySelector('#street').value,input.street);k.form.dispatchEvent(new k.dom.window.CustomEvent('request-delivery-state-changed'));assert.equal(k.form.querySelector('#address-check').disabled,true);k.form.dataset.deliveryUnknown='false';k.form.dispatchEvent(new k.dom.window.CustomEvent('request-delivery-state-changed'));assert.equal(k.form.querySelector('#address-check').disabled,false);k.dom.window.close();
});
test('an address-check outage never disables the customer submit button',async()=>{
 const h=harness(async()=>{throw Error('synthetic outage');});h.click();await tick();assert.match(h.result().textContent,/keep your entry and continue/);assert.equal(h.form.querySelector('button[type=submit]').disabled,false);assert.equal(h.form.querySelector('#street').value,input.street);h.dom.window.close();
});
test('public address endpoint enforces same origin, bounded local inputs and the durable read quota before Census',async()=>{
 const priorFetch=globalThis.fetch,priorEnv={CRM_AVAILABILITY_URL:process.env.CRM_AVAILABILITY_URL,CRM_AVAILABILITY_BYPASS_SECRET:process.env.CRM_AVAILABILITY_BYPASS_SECRET,VERCEL:process.env.VERCEL};
 Object.assign(process.env,{CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:'s'.repeat(40),VERCEL:'0'});
 let calls=[];globalThis.fetch=async(url,options)=>{calls.push(String(url));if(String(url).includes('/api/website-guard')){const payload=JSON.parse(options.body);assert.equal(payload.operation,'availability');assert.ok(!options.body.includes(input.street));return response({allowed:true});}return response({result:{addressMatches:[match]}});};
 const request={method:'POST',headers:{origin:'https://example.invalid',host:'example.invalid'},socket:{remoteAddress:'127.0.0.1'},body:input};
 const invoke=async req=>{const result={headers:{},statusCode:0,value:null,setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.value=value;return this;}};await handler(req,result);return result;};
 try{
  assert.equal((await invoke({...request,headers:{...request.headers,origin:'https://other.invalid'}})).statusCode,403);assert.equal(calls.length,0);
  assert.equal((await invoke({...request,body:{...input,state:'DC'}})).statusCode,400);assert.equal(calls.length,0);
  const result=await invoke(request);assert.equal(result.statusCode,200);assert.equal(result.value.status,'match');assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(calls.length,2);assert.ok(calls[1].startsWith('https://geocoding.geo.census.gov/'));
  calls=[];globalThis.fetch=async()=>{calls.push('guard');return new Response(JSON.stringify({allowed:false}),{status:429});};assert.equal((await invoke(request)).statusCode,429);assert.deepEqual(calls,['guard']);
 }finally{globalThis.fetch=priorFetch;for(const [name,value] of Object.entries(priorEnv)){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
