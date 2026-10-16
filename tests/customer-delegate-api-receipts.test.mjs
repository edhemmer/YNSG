import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';
const org='20000000-0000-4000-8000-000000000001';
const customer='30000000-0000-4000-8000-000000000001';
const user='40000000-0000-4000-8000-000000000001';
function harness({result={customer,user,revoked:true,canApprove:false,canViewBilling:false,changed:true},denied=false}={}){
 const calls=[];
 const source=readFileSync('apps/web/app/api/customer-delegate/route.ts','utf8').replace(/^import .*;\n/gm,'');
 const js=stripTypeScriptTypes(source).replace(/^export /gm,'')+'\nexports.POST=POST;';
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:result,error:null};}};
 const response={json:(data,options)=>new Response(JSON.stringify(data),options)};
 const ctx={exports:{},z,Buffer,URL,Error,NextResponse:response,authenticated:async()=>({db}),sameOrigin:()=>!denied,failure:()=>new Response('{}',{status:503})};
 runInNewContext(js,ctx);return {POST:ctx.exports.POST,calls};
}
const input=(action,more={})=>new Request('https://example.invalid/api/customer-delegate',{method:'POST',body:JSON.stringify({organization:org,customer,user,action,...more})});
test('revoke requires matching confirmed revoked receipt',async()=>{
 const ok=harness();const res=await ok.POST(input('revoke'));assert.equal(res.status,200);assert.equal(ok.calls[0].args.p_action,'revoke');
 for(const result of [null,{}, {customer,user,revoked:false,canApprove:false,canViewBilling:false,changed:true},{customer:org,user,revoked:true,canApprove:false,canViewBilling:false,changed:true}]){
  assert.equal((await harness({result}).POST(input('revoke'))).status,503);
 }
});
test('capability updates cannot report success for altered or revoked permissions',async()=>{
 const valid={customer,user,revoked:false,canApprove:true,canViewBilling:false,changed:true};
 assert.equal((await harness({result:valid}).POST(input('capabilities',{canApprove:true,canViewBilling:false}))).status,200);
 for(const result of [{...valid,canApprove:false},{...valid,revoked:true},{...valid,canViewBilling:true}]){
  assert.equal((await harness({result}).POST(input('capabilities',{canApprove:true,canViewBilling:false}))).status,503);
 }
});
test('reject cross-origin and invalid POST before touching database',async()=>{
 const denied=harness({denied:true});assert.equal((await denied.POST(input('revoke'))).status,403);assert.equal(denied.calls.length,0);
 const invalid=harness();assert.equal((await invalid.POST(input('forged'))).status,400);assert.equal(invalid.calls.length,0);
});
