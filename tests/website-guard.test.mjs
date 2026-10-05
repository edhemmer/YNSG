import test from 'node:test';import assert from 'node:assert/strict';
import {websiteGuard,websiteRequest,guardDigest,validGuardSignature} from '../lib/website-guard.js';
const secret='synthetic-only-credential-00000000000';const clock=Date.now(),body='{"operation":"availability"}',stamp=String(clock);
test('guard proof rejects tampering, missing credential and expired proof',()=>{const signature=guardDigest(secret,stamp+':'+body);assert.equal(validGuardSignature(secret,body,stamp,signature,clock),true);assert.equal(validGuardSignature(secret,body+'x',stamp,signature,clock),false);assert.equal(validGuardSignature(secret,body,stamp,signature,clock+60001),false);assert.equal(validGuardSignature('',body,stamp,signature,clock),false);});
test('guard sends only keyed digests; forged proxy address is ignored locally',async()=>{let data;await websiteGuard({headers:{'x-forwarded-for':'8.8.8.8'},socket:{remoteAddress:'127.0.0.1'}},'request',{key:'stable-key',email:'test@example.invalid'},{CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:secret},async(url,init)=>{assert.equal(url.pathname,'/api/website-guard');data=init.body;return Response.json({allowed:true});});assert.equal(data.includes('127.0.0.1'),false);assert.equal(data.includes('test@example.invalid'),false);assert.equal(JSON.parse(data).clientHash,guardDigest(secret,'ip:127.0.0.1'));});
test('denied quota and service outages fail closed',async()=>{const req={headers:{},socket:{remoteAddress:'127.0.0.1'}},env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:secret};await assert.rejects(websiteGuard(req,'availability',{},env,async()=>Response.json({allowed:false},{status:429})),e=>e.status===429);await assert.rejects(websiteGuard(req,'availability',{},env,async()=>Response.json({allowed:false},{status:503})),e=>e.status===503);});

test('signed request transport retains selected work and rejects false provider success',async()=>{
 const req={headers:{},socket:{remoteAddress:'127.0.0.1'}},env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:secret},data={email:'test@example.invalid',services:[{service:'Lawn care',task:'Mowing'},{service:'Yard & garden',task:'Planting flowers'}]},key='80000000-0000-4000-8000-000000000001';
 const result=await websiteRequest(req,data,key,env,async(url,options)=>{assert.equal(url.pathname,'/api/website-request');const envelope=JSON.parse(options.body);assert.deepEqual(envelope.data,data);assert.equal(envelope.key,key);assert.equal(validGuardSignature(secret,options.body,options.headers['x-ynsg-guard-time'],options.headers['x-ynsg-guard-signature']),true);assert.equal(options.body.includes('127.0.0.1'),false);return Response.json({ok:true,id:key});});
 assert.equal(result.saved,true);
 await assert.rejects(websiteRequest(req,data,key,env,async()=>Response.json({ok:true,id:'invalid'})),e=>e.status===503);
 await assert.rejects(websiteRequest(req,data,key,env,async()=>Response.json({ok:false},{status:429})),e=>e.status===429);
});
import requestHandler from '../api/requests.js';
const response=()=>({code:0,payload:null,setHeader(){},status(v){this.code=v;return this;},json(v){this.payload=v;return this;}});
test('honeypot and cross-site attempts cause no provider or database work',async(t)=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not call');});
 const trapped=response();await requestHandler({method:'POST',headers:{},body:{website:'bot-filled-field'}},trapped);assert.equal(trapped.code,200);
 const cross=response();await requestHandler({method:'POST',headers:{'sec-fetch-site':'cross-site'},body:{website:''}},cross);assert.equal(cross.code,403);assert.equal(calls,0);
});
