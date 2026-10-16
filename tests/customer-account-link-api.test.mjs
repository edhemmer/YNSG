import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';
const org='20000000-0000-4000-8000-000000000001',customer='30000000-0000-4000-8000-000000000001';
function harness({receipt={expiresAt:'2026-10-17T12:00:00Z'},origin='https://yourneighborhoodserviceguy.app',same=true}={}){
 const source=readFileSync('apps/web/app/api/account-link/route.ts','utf8');
 const code=stripTypeScriptTypes(source.slice(source.indexOf('const headers =')).replace(/^export /gm,''))+'\nexports.POST=POST;';
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:receipt,error:null};}};
 const cookies=async()=>({get:()=>undefined});
 const NextResponse={json:(body,opt={})=>{const response=new Response(JSON.stringify(body),{...opt,headers:opt.headers});response.cookies={set:()=>{}};return response;}};
 const context={exports:{},z,Buffer,URL,Error,NextResponse,randomBytes:()=>Buffer.alloc(32,7),createHash:()=>({update:()=>({digest:()=> 'a'.repeat(64)})}),authenticated:async()=>({db}),sameOrigin:()=>same,cookies,process:{env:{APP_ORIGIN:origin}},failure:()=>new Response(JSON.stringify({error:'Unavailable'}),{status:503})};
 runInNewContext(code,context);return {POST:context.exports.POST,calls};
}
const payload={action:'invite',organization:org,customer,email:'example@example.invalid'};
function request(body=JSON.stringify(payload)){return new Request('https://yourneighborhoodserviceguy.app/api/account-link',{method:'POST',body,headers:{Origin:'https://yourneighborhoodserviceguy.app'}});}
test('bounded invitation requires configured trusted canonical origin before writes',async()=>{
 for(const origin of ['', 'http://example.invalid','https://evil.test/path','https://evil.test:9999']){
  const h=harness({origin}),response=await h.POST(request());assert.equal(response.status,503);assert.equal(h.calls.length,0);
 }
 const h=harness(),response=await h.POST(request());assert.equal(response.status,200);assert.equal(h.calls.length,1);
 assert.match((await response.json()).url,/^https:\/\/yourneighborhoodserviceguy\.app\/account#invite=[a-zA-Z0-9_-]{43}$/);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
});
test('oversized, malformed and cross-origin invitations never reach database',async()=>{
 const huge=harness(),response=await huge.POST(request('x'.repeat(4097)));assert.equal(response.status,413);assert.equal(huge.calls.length,0);
 const invalid=harness(),res=await invalid.POST(request(JSON.stringify({...payload,unexpected:true})));assert.equal(res.status,400);assert.equal(invalid.calls.length,0);
 const denied=harness({same:false});assert.equal((await denied.POST(request())).status,403);assert.equal(denied.calls.length,0);
});
test('unexpected invitation RPC response never presents successful link',async()=>{
 for(const receipt of [{}, {expiresAt:'not-a-date'}, null]){
  const h=harness({receipt}),response=await h.POST(request());assert.equal(response.status,503);assert.equal(h.calls.length,1);
  assert.ok(!JSON.stringify(await response.json()).includes('#invite='));
 }
});
