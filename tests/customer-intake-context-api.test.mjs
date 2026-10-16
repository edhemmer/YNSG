import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';

const org='20000000-0000-4000-8000-000000000001';
function make({data={contacts:[],properties:[],services:[]},error=null}={}){
 const calls=[];
 const source=readFileSync('apps/web/app/api/account-request/route.ts','utf8').replace(/^import .*;\n/gm,'');
 const code=stripTypeScriptTypes(source).replace(/^export /gm,'')+'\nexports.GET=GET;';
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data,error};}};
 const scope={exports:{},z,URL,Buffer,Error,NextResponse:{json:(value,options)=>new Response(JSON.stringify(value),options)},authenticated:async()=>({db}),failure:()=>new Response('{}',{status:503}),repeatRequestContext:{safeParse:value=>value&&Array.isArray(value.contacts)&&Array.isArray(value.properties)&&Array.isArray(value.services)?{success:true,data:value}:{success:false}}};
 runInNewContext(code,scope);
 return {get:scope.exports.GET,calls};
}
const request=value=>new Request('https://example.invalid/api/account-request?organization='+value);
test('account intake GET accepts only UUID and returns private validated context',async()=>{
 const x=make(),ok=await x.get(request(org));
 assert.equal(ok.status,200);
 assert.equal(ok.headers.get('Cache-Control'),'private, no-store');
 assert.equal(x.calls[0].name,'customer_intake_context');
 assert.equal(x.calls[0].args.p_org,org);
 const invalid=make();assert.equal((await invalid.get(request('invalid'))).status,400);assert.equal(invalid.calls.length,0);
 assert.equal((await make({data:null}).get(request(org))).status,503);
});
test('account intake GET separates permission denial from transient outage',async()=>{
 assert.equal((await make({error:{code:'42501',message:'FORBIDDEN'}}).get(request(org))).status,403);
 assert.equal((await make({error:{code:'08006',message:'connection lost'}}).get(request(org))).status,503);
});
