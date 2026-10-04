import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Public website bridge is a Node.js JavaScript module.
import { saveCrmRequest, IntakeFailure } from '../lib/public-intake.js';
const org='20000000-0000-4000-8000-000000000001';
const env={CRM_ORGANIZATION_ID:org,SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key',CRM_INTAKE_HASH_KEY:'synthetic-only-secret-at-least-32-characters',VERCEL:'1'};
const req={headers:{'x-vercel-forwarded-for':'192.0.2.10'}};
const data={services:[{service:'Lawn care',task:'Leaf management'},{service:'Yard & garden',task:'Planting flowers'}],name:'Synthetic customer',phone:'5550000000',email:'customer@example.invalid',street:'100 Synthetic St',city:'DeKalb',communityRate:'No',description:'',website:'',preferredTime:''};
const key='80000000-0000-4000-8000-000000000001';
test('CRM bridge binds server tenant and retains all services without sending contact details to logs or client keys',async()=>{
  const calls: {url:string;body:Record<string,unknown>;headers:Record<string,string>}[]=[];
  const transport=async(url:URL,options:{body:string;headers:Record<string,string>})=>{calls.push({url:String(url),body:JSON.parse(options.body),headers:options.headers});return Response.json({ok:true,id:key,notification:'pending'});};
  assert.deepEqual(await saveCrmRequest(req,data,key,env,transport),{ok:true,id:key,notification:'pending',saved:true});
  await saveCrmRequest(req,data,key,env,transport);
  assert.equal(calls[0]!.body.p_org,org);assert.equal(calls[0]!.body.p_key,key);
  assert.deepEqual(calls[0]!.body.p_data,data);assert.match(String(calls[0]!.body.p_client_hash),/^[a-f0-9]{64}$/);
  assert.equal(calls[0]!.body.p_client_hash,calls[1]!.body.p_client_hash);
  assert.ok(!JSON.stringify(calls[0]!.body).includes('192.0.2.10'));
  assert.equal(calls[0]!.headers.apikey,'synthetic-server-key');
});
test('CRM bridge rejects missing or unsafe connection configuration before making a request',async()=>{
  let calls=0;const transport=async()=>{calls++;return Response.json({ok:true,id:key});};
  for(const invalid of [{...env,CRM_ORGANIZATION_ID:''},{...env,SUPABASE_URL:'http://synthetic.supabase.co'},{...env,SUPABASE_URL:'https://untrusted.invalid'},{...env,CRM_INTAKE_HASH_KEY:'short'}])await assert.rejects(saveCrmRequest(req,data,key,invalid,transport),(e:unknown)=>e instanceof Error && e instanceof IntakeFailure && (e as Error & {status:number}).status===503);
  await assert.rejects(saveCrmRequest({headers:{'x-forwarded-for':'192.0.2.10'}},data,key,env,transport));
  assert.equal(calls,0);
});
test('CRM failures preserve retry semantics and never produce false success',async()=>{
  for(const [message,status] of [['RATE_LIMITED',429],['IDEMPOTENCY_CONFLICT',409],['VALIDATION',400],['SETUP_REQUIRED',503]] as const){
    await assert.rejects(saveCrmRequest(req,data,key,env,async()=>Response.json({message},{status:400})),(e:unknown)=>e instanceof Error && e instanceof IntakeFailure && (e as Error & {status:number}).status===status);
  }
  await assert.rejects(saveCrmRequest(req,data,key,env,async()=>{throw new Error('synthetic outage');}));
  await assert.rejects(saveCrmRequest(req,data,key,env,async()=>Response.json({ok:true,id:'invalid'})));
});
// @ts-expect-error Public Vercel handler is JavaScript.
import handler from '../api/requests.js';
function resultCollector(){
  return {code:0,payload:null as unknown,setHeader(){},status(code:number){this.code=code;return this;},json(payload:unknown){this.payload=payload;return this;}};
}
function configure(t: {after:(fn:()=>void)=>void}, overrides:Record<string,string>){
  const prior=Object.fromEntries(Object.keys(overrides).map(k=>[k,process.env[k]]));
  Object.assign(process.env,overrides);
  t.after(()=>{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
}
test('real public handler retains legacy email with identical payload and provider retry key',async(t)=>{
  configure(t,{CRM_INTAKE_ENABLED:'false',RESEND_API_KEY:'synthetic-key'});
  const sent:RequestInit[]=[];
  t.mock.method(globalThis,'fetch',async(_url:unknown,options:RequestInit)=>{sent.push(options);return Response.json({id:'synthetic-provider-id'});});
  for(let i=0;i<2;i++){const res=resultCollector();await handler({method:'POST',headers:{host:'synthetic.invalid'},body:{...data,requestKey:key}},res);assert.equal(res.code,200);}
  assert.equal(sent.length,2);assert.equal(sent[0]!.body,sent[1]!.body);
  assert.equal((sent[0]!.headers as Record<string,string>)['Idempotency-Key'],`ynsg-request-${key}`);
  const email=JSON.parse(String(sent[0]!.body));assert.equal(email.subject,'Your Neighborhood Service Guy New Request');assert.deepEqual(email.to,['edhemmer@gmail.com']);assert.equal(email.reply_to,data.email);assert.ok(email.html.indexOf('Call customer')<email.html.indexOf('Work requested'));assert.ok(email.html.includes('Leaf management'));assert.ok(email.html.includes('Planting flowers'));assert.ok(email.text.includes('Request ID: '+key));assert.ok(email.text.endsWith('Best Regards,\nEdward Hemmer'));assert.ok(email.html.includes('/assets/logo.jpg'));
});
test('real CRM handler returns only committed success and never falls back to email after a database failure',async(t)=>{
  configure(t,{...env,CRM_INTAKE_ENABLED:'true'});
  const calls:string[]=[];let fail=false;
  t.mock.method(globalThis,'fetch',async(url:unknown)=>{calls.push(String(url));return fail?Response.json({message:'SETUP_REQUIRED'},{status:400}):Response.json({ok:true,id:key});});
  const request={method:'POST',headers:{...req.headers,host:'synthetic.invalid'},body:{...data,requestKey:key,organizationId:'malicious-client-tenant'}};
  const saved=resultCollector();await handler(request,saved);assert.equal(saved.code,200);assert.deepEqual(saved.payload,{ok:true,id:key,notification:'pending',saved:true});
  fail=true;const failed=resultCollector();await handler(request,failed);assert.equal(failed.code,503);
  assert.equal(calls.length,2);assert.ok(calls.every(u=>u.endsWith('/rest/v1/rpc/submit_service_request')));
});
