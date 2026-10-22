import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';

const org='20000000-0000-4000-8000-000000000001';
const command={organizationId:org,expectedVersion:3,key:'synthetic-settings-publish-key',settings:{displayName:'Synthetic'},catalog:[]};
function harness({receipt={version:4},publishError=null,origin=true,brand=true,ready=true,readError=null}={}){
 const calls=[];
 const source=readFileSync('apps/web/app/api/configuration/route.ts','utf8').replace(/^import .*;\n/gm,'');
 const code=stripTypeScriptTypes(source).replace(/^export /gm,'')+'\nexports.POST=POST;exports.GET=GET;';
 const table={select:()=>table,eq:()=>table,order:()=>table,limit:()=>table,maybeSingle:async()=>({data:{settings:{}},error:readError})};
 const db={from:(name)=>{calls.push(name);return table;},rpc:async(name)=>{calls.push(name);return name==='production_workflows_ready'?{data:ready,error:null}:{data:receipt,error:publishError};}};
 const context={exports:{},z,Buffer,URL,Error,NextResponse:{json:(data,options)=>new Response(JSON.stringify(data),options)},sameOrigin:()=>origin,authenticated:async()=>({db}),configurationCommand:{parse:v=>v},validateConfiguration:v=>v,preservesLicensedBrand:()=>brand,failure:()=>new Response(JSON.stringify({error:'Unavailable'}),{status:503})};
 runInNewContext(code,context);
 return {...context.exports,calls};
}
function request(value=command){return new Request('https://example.invalid/api/configuration',{method:'POST',body:JSON.stringify(value)});}
test('settings publish rejects uncertain RPC results without asserting a failed save',async()=>{
 for(const error of [{message:'Network uncertain',code:'08006'},{message:'VALIDATION',code:'P0001'}]){
  const h=harness({publishError:error}),res=await h.POST(request());
  assert.equal(res.status,503);
  assert.equal(res.headers.get('Cache-Control'),'private, no-store');
  assert.match((await res.json()).error,/not confirmed/i);
  assert.ok(h.calls.includes('publish_configuration'));
 }
});
test('settings publication differentiates stale version and permission denial',async()=>{
 for(const [error,status] of [[{message:'STALE_REVISION',code:'P0001'},409],[{message:'FORBIDDEN',code:'42501'},403]]){
  const res=await harness({publishError:error}).POST(request());
  assert.equal(res.status,status);
  assert.equal(res.headers.get('Cache-Control'),'private, no-store');
 }
});
test('settings require a matching next-version receipt before reporting success',async()=>{
 for(const receipt of [null,{}, {version:3},{version:5},{version:'4'}]){
  const res=await harness({receipt}).POST(request());
  assert.equal(res.status,503);
 }
 const valid=await harness().POST(request());
 assert.equal(valid.status,200);
 assert.equal(valid.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await valid.json()).result.version,4);
});
test('settings GET rejects invalid organization and successful response is private',async()=>{
 const h=harness();
 const invalid=await h.GET(new Request('https://example.invalid/api/configuration?organization=not-an-id'));
 assert.equal(invalid.status,400);
 assert.equal(invalid.headers.get('Cache-Control'),'private, no-store');
 assert.equal(h.calls.length,0);
 const valid=await h.GET(new Request('https://example.invalid/api/configuration?organization='+org));
 assert.equal(valid.status,200);
 assert.equal(valid.headers.get('Cache-Control'),'private, no-store');
});
test('settings POST rejects cross-origin command without entering database',async()=>{
 const h=harness({origin:false});
 assert.equal((await h.POST(request())).status,403);
 assert.equal(h.calls.length,0);
});
