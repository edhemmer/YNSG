import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import {runInNewContext} from 'node:vm';
const raw=readFileSync('apps/web/lib/session.ts','utf8').replace(/^import .*;\n/gm,'');
function harness(result,{token='synthetic-access',origin='https://crm.example.invalid'}={}){
 let reads=0;const written=[];const context={exports:{},Error,process:{env:{SUPABASE_URL:'https://provider.example.invalid',SUPABASE_PUBLISHABLE_KEY:'synthetic-key',APP_ORIGIN:origin,NODE_ENV:'production'}},createClient:()=>({auth:{getUser:async()=>{reads++;return typeof result==='function'?result():result;}}}),cookies:async()=>({get:()=>token?{value:token}:undefined}),NextResponse:{json:(data,options)=>Response.json(data,options)}};
 runInNewContext(stripTypeScriptTypes(raw).replace(/^export /gm,'')+'\nObject.assign(exports,{authenticated,failure,saveSession,sameOrigin});',context);
 return {...context.exports,reads:()=>reads,written};
}
test('provider outages preserve saved access and produce retryable 503 instead of sign-in rejection',async()=>{
 for(const result of [{data:{user:null},error:{status:500}},{data:{user:null},error:{status:0}},()=>{throw Error('private transport detail');}]){
  const h=harness(result);await assert.rejects(h.authenticated(),asyncError=>{assert.equal(asyncError.message,'AUTH_UNAVAILABLE');const r=h.failure(asyncError);assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');return true;});
 }
});
test('missing, expired and rejected credentials fail closed; confirmed identity passes',async()=>{
 for(const status of [400,401,403]){const h=harness({data:{user:null},error:{status}});await assert.rejects(h.authenticated(),e=>{assert.equal(h.failure(e).status,401);return true;});}
 const missing=harness(null,{token:null});await assert.rejects(missing.authenticated(),/UNAUTHORIZED/);assert.equal(missing.reads(),0);
 const valid=harness({data:{user:{id:'synthetic-user'}},error:null});assert.equal((await valid.authenticated()).user.id,'synthetic-user');
});
test('cookie lifetime renews without exposing credentials; origin boundaries remain exact',()=>{
 const h=harness(null);const records=[];const response={headers:new Headers(),cookies:{set:(...args)=>records.push(args)}};
 h.saveSession(response,{access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600});
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(records[0][2].maxAge,3600);assert.equal(records[1][2].maxAge,2592000);
 for(const [, ,opts] of records){assert.equal(opts.httpOnly,true);assert.equal(opts.secure,true);assert.equal(opts.sameSite,'strict');assert.equal(opts.domain,undefined);}
 for(const origin of ['https://evil.example.invalid','https://crm.example.invalid.evil.invalid',null])assert.equal(h.sameOrigin(new Request('https://crm.example.invalid/api/session',{headers:origin?{origin}:{}})),false);
 assert.equal(h.sameOrigin(new Request('https://crm.example.invalid/api/session',{headers:{origin:'https://crm.example.invalid'}})),true);
});

test('both production domains accept only their own browser origin, and reject cross-domain posts',()=>{
 const h=harness(null);
 for(const host of ['https://yourneighborhoodserviceguy.app','https://yourneighborhoodserviceguy.com']){
  assert.equal(h.sameOrigin(new Request(host+'/api/session',{headers:{origin:host}})),true);
  assert.equal(h.sameOrigin(new Request(host+'/api/session',{headers:{origin:'https://crm.example.invalid'}})),false);
  assert.equal(h.sameOrigin(new Request(host+'/api/session',{headers:{origin:'https://evil.example.invalid'}})),false);
 }
 assert.equal(h.sameOrigin(new Request('https://evil.example.invalid/api/session',{headers:{origin:'https://evil.example.invalid'}})),false);
});
