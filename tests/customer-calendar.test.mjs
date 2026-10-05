import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentSelection,weeklyDates,yearEnd} from '../lib/appointment-window.js';
import {validGuardSignature} from '../lib/website-guard.js';
import {websiteAvailability} from '../lib/website-availability.js';
import handler from '../api/requests.js';
const now=Date.parse('2026-10-04T16:00:00Z');
test('30-day boundary is enforced for one-time and recurring first visits',()=>{
 for(const mode of ['once','weekly']){assert.equal(appointmentSelection({mode,start:'2026-11-03T15:00:00Z'},now).firstDate,'2026-11-03');assert.throws(()=>appointmentSelection({mode,start:'2026-11-04T15:00:00Z'},now));}
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-10-10T15:00:00Z'},now));
});
test('weekly calendar dates preserve weekday and cover 12 months including leap-year ending',()=>{
 const result=appointmentSelection({mode:'weekly',start:'2026-10-05T14:00:00Z'},now);assert.equal(result.localTime,'09:00');assert.equal(result.endExclusive,'2027-10-05');assert.ok(result.preferredTime.includes('Owner approval required'));
 assert.ok(weeklyDates('2026-10-05').dates.every(day=>new Date(day+'T12:00Z').getUTCDay()===1));assert.equal(yearEnd('2028-02-29'),'2029-02-28');
});
test('availability response exposes slots only and rejects invalid provider data',async()=>{
 const env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability'},start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+93600000).toISOString(),validUntil=new Date(Date.now()+60000).toISOString();
 const data={times:[{start,end,customer:'Private contact'}],reserved:false,timezone:'America/Chicago',validUntil};
 assert.equal(JSON.stringify(await websiteAvailability(env,async()=>Response.json(data))).includes('Private'),false);
 await assert.rejects(websiteAvailability(env,async()=>Response.json({...data,times:[{start,end:'invalid'}]})));
 await assert.rejects(websiteAvailability(env,async()=>Response.json({error:'private'},{status:503})));
});
const base={services:[{service:'Lawn care',task:'Leaf management'}],name:'Synthetic Contact',email:'synthetic@example.invalid',phone:'5550000000',street:'100 Test Street',city:'DeKalb',description:'',communityRate:'No',website:''};
const response=()=>({code:0,payload:null,setHeader(){},status(v){this.code=v;return this;},json(v){this.payload=v;return this;}});
test('forged out-of-window input is rejected without sending email',async(t)=>{
 let sent=0;t.mock.method(globalThis,'fetch',async()=>{sent++;return Response.json({ok:true,id:'80000000-0000-4000-8000-000000000001'});});
 const res=response();await handler({method:'POST',headers:{host:'synthetic.invalid'},socket:{remoteAddress:'127.0.0.1'},body:{...base,appointmentSelection:{mode:'once',start:'2099-10-05T14:00:00Z'}}},res);assert.equal(res.code,400);assert.equal(sent,0);
});
test('no-time request is saved with weekly intent and customer email',async(t)=>{
 const overrides={CRM_INTAKE_ENABLED:'false',RESEND_API_KEY:'synthetic',CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:'synthetic-only-credential-00000000000',VERCEL:'0'};const prior=Object.fromEntries(Object.keys(overrides).map(k=>[k,process.env[k]]));Object.assign(process.env,overrides);t.after(()=>{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 let message;t.mock.method(globalThis,'fetch',async(_url,options)=>{if(new URL(_url).pathname==='/api/website-guard')return Response.json({allowed:true});message=JSON.parse(options.body);return Response.json({ok:true,id:'80000000-0000-4000-8000-000000000001'});});
 const res=response();await handler({method:'POST',headers:{host:'synthetic.invalid'},socket:{remoteAddress:'127.0.0.1'},body:{...base,appointmentSelection:{mode:'weekly',start:null}}},res);assert.equal(res.code,200);assert.ok(message.data.preferredTime.includes('Weekly visits for 12 months'));assert.equal(message.data.email,base.email);
});

test('deployment credential stays in server request headers and never enters slot response',async()=>{
 const env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability',CRM_AVAILABILITY_BYPASS_SECRET:'synthetic-test-only-credential-00000000'};
 const data={times:[],reserved:false,timezone:'America/Chicago',validUntil:new Date(Date.now()+60000).toISOString()};
 let options;const result=await websiteAvailability(env,async(_url,init)=>{options=init;return Response.json(data);});
 assert.equal(options.headers['x-vercel-protection-bypass'],env.CRM_AVAILABILITY_BYPASS_SECRET);assert.equal(validGuardSignature(env.CRM_AVAILABILITY_BYPASS_SECRET,'availability',options.headers['x-ynsg-guard-time'],options.headers['x-ynsg-guard-signature']),true);assert.equal(JSON.stringify(result).includes(env.CRM_AVAILABILITY_BYPASS_SECRET),false);
 await assert.rejects(websiteAvailability({...env,CRM_AVAILABILITY_BYPASS_SECRET:'short'},async()=>{throw Error('must not call provider');}),/SETUP_REQUIRED/);
});
