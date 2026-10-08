import test from 'node:test';import assert from 'node:assert/strict';
import {appointmentHold} from '../site/appointment-hold.js';
import {websiteHold,websiteRequest,validGuardSignature} from '../lib/website-guard.js';
const key='11111111-1111-4111-8111-111111111111',clientKey='22222222-2222-4222-8222-222222222222';
const input={action:'select',key,clientKey,token:null,start:new Date(Date.now()+86400000).toISOString()},secret='s'.repeat(32);
const reply=()=>({ok:true,token:'a'.repeat(64),start:input.start,end:new Date(Date.parse(input.start)+7200000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
test('selection requires a current two-hour hold receipt and preserves conflicts',async()=>{
 assert.equal((await appointmentHold(input,async()=>Response.json(reply()))).token,'a'.repeat(64));
 const offsetReply={...reply(),start:input.start.replace('Z','+00:00'),end:reply().end.replace('Z','+00:00')};
 assert.equal((await appointmentHold(input,async()=>Response.json(offsetReply))).start,input.start);
 for(const value of [{...reply(),token:'invalid'},{...reply(),expiresAt:new Date(Date.now()-1).toISOString()},{...reply(),start:new Date(Date.now()).toISOString()},{...reply(),end:input.start}])await assert.rejects(appointmentHold(input,async()=>Response.json(value)));
 await assert.rejects(appointmentHold(input,async()=>Response.json({error:'That time is no longer available. Please choose another time.'},{status:409})),error=>error.status===409);
});
test('a stalled selection aborts without showing a false hold; release works without a received token',async()=>{
 await assert.rejects(appointmentHold(input,async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('TIMEOUT')),{once:true})),10),/TIMEOUT/);
 let sent;await appointmentHold({...input,action:'release',start:null},async(url,options)=>{assert.equal(options.keepalive,true);sent=JSON.parse(options.body);return Response.json({ok:true});});
 assert.equal(sent.key,key);assert.equal(sent.token,null);
});
test('server bridge signs the body, hashes the client address and strips extra response data',async()=>{
 const env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:secret};
 const req={headers:{},socket:{remoteAddress:'127.0.0.1'}};
 const result=await websiteHold(req,input,env,async(url,options)=>{
  assert.equal(url.pathname,'/api/website-hold');
  assert.ok(validGuardSignature(secret,options.body,options.headers['x-ynsg-guard-time'],options.headers['x-ynsg-guard-signature']));
  const sent=JSON.parse(options.body);assert.match(sent.clientHash,/^[a-f0-9]{64}$/);assert.equal(options.body.includes('127.0.0.1'),false);
  return Response.json({...reply(),appointmentId:'private',customer:'private'});
 });
 assert.equal(result.appointmentId,undefined);assert.equal(result.customer,undefined);
 await assert.rejects(websiteHold(req,input,{...env,CRM_AVAILABILITY_URL:'https://untrusted.invalid/api/public-availability'},async()=>{throw Error('must not call');}));
 await assert.rejects(websiteHold(req,input,env,async()=>Response.json({ok:false},{status:429})),error=>error.status===429);
});
test('request bridge preserves the structured held selection and maps lost holds to an actionable conflict',async()=>{
 const env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:secret},req={headers:{},socket:{remoteAddress:'127.0.0.1'}},selection={mode:'once',start:input.start,clientKey,token:'a'.repeat(64)};
 const receipt=await websiteRequest(req,{email:'test@example.invalid'},key,env,async(url,options)=>{assert.deepEqual(JSON.parse(options.body).selection,selection);return Response.json({ok:true,id:key});},selection);
 assert.equal(receipt.saved,true);
 await assert.rejects(websiteRequest(req,{email:'test@example.invalid'},key,env,async()=>Response.json({ok:false},{status:409}),selection),error=>error.status===409&&error.message.includes('choose another time'));
});
