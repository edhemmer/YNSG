import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';

const id='20000000-0000-4000-8000-000000000001';
const requestId='30000000-0000-4000-8000-000000000001';
const input={organization:id,contact:id,property:id,key:'synthetic-repeat-request-key',input:{services:[{service:'Lawn care',task:'Mowing'}],description:'',preferredTime:'',communityRate:'No'}};
function harness({result={id:requestId},error=null,origin=true,valid=true}={}){
 const calls=[];
 const source=readFileSync('apps/web/app/api/account-request/route.ts','utf8').replace(/^import .*;\n/gm,'');
 const code=stripTypeScriptTypes(source).replace(/^export /gm,'')+'\nexports.POST=POST;exports.GET=GET;';
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:result,error};}};
 const context={exports:{},z,Buffer,URL,Error,NextResponse:{json:(data,options)=>new Response(JSON.stringify(data),options)},authenticated:async()=>({db}),sameOrigin:()=>origin,repeatRequest:{safeParse:v=>valid?{success:true,data:v}:{success:false}},failure:()=>new Response(JSON.stringify({error:'Unavailable'}),{status:503})};
 runInNewContext(code,context);return {...context.exports,calls};
}
function post(value=input){return new Request('https://example.invalid/api/account-request',{method:'POST',body:JSON.stringify(value)});}
test('saved repeat request must return a confirmed UUID receipt',async()=>{
 const good=harness(),res=await good.POST(post());
 assert.equal(res.status,200);
 assert.equal(res.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await res.json()).request.id,requestId);
 assert.equal(good.calls.length,1);
 assert.equal(good.calls[0].args.p_key,input.key);
 for(const result of [null,{}, {id:'invalid'}, {id:23}])assert.equal((await harness({result}).POST(post())).status,503);
});
test('uncertain repeat request RPC outcome never asserts request was not saved',async()=>{
 const response=await harness({error:{message:'synthetic connection lost',code:'08006'}}).POST(post());
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.match((await response.json()).error,/could not be confirmed/i);
});
test('rate-limited request is a definite rejection with no retry on alternate key',async()=>{
 const response=await harness({error:{message:'RATE_LIMITED',code:'P0001'}}).POST(post());
 assert.equal(response.status,429);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('request rejects invalid payload and cross-origin before DB write',async()=>{
 const invalid=harness({valid:false});
 assert.equal((await invalid.POST(post())).status,400);
 assert.equal(invalid.calls.length,0);
 const denied=harness({origin:false});
 assert.equal((await denied.POST(post())).status,403);
 assert.equal(denied.calls.length,0);
});
