import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const z=require('zod');
const contract=await import('../apps/web/lib/customer-file-contract.ts');
const org='20000000-0000-4000-8000-000000000001',customer='30000000-0000-4000-8000-000000000001',file='40000000-0000-4000-8000-000000000001';
const src=readFileSync('apps/web/app/api/customer-files/route.ts','utf8');
function harness(uploadError){
 const calls=[];
 const db={rpc:async(name)=>{
  calls.push(name);
  if(name==='reserve_customer_file')return {data:{id:file,path:org+'/'+file,ready:false},error:null};
  if(name==='finalize_customer_file')return {data:{id:file,ready:true},error:null};
  return {data:[],error:null};
 },storage:{from:()=>({upload:async()=>({error:uploadError})})}};
 const headers={};
 const NextResponse={json:(data,options={})=>new Response(JSON.stringify(data),{status:options.status||200,headers:options.headers})};
 const imports={createHash,z,NextResponse,authenticated:async()=>({db}),sameOrigin:()=>true,failure:()=>NextResponse.json({error:'error'},{status:503}),...contract};
 let code=src.split('\n').filter(line=>!line.startsWith('import ')&&!line.startsWith('export const dynamic')).join('\n');
 code=stripTypeScriptTypes(code.replace(/^export /gm,''))+'\nexports.POST=POST;';
 const scope={...imports,exports:{},Buffer,File,FormData,Uint8Array,Request,Response,URL};
 runInNewContext(code,scope);
 return {post:scope.exports.POST,calls};
}
function input(){
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
 const form=new FormData();form.set('organization',org);form.set('customer',customer);form.set('key','50000000-0000-4000-8000-000000000001');form.set('purpose','receipt');form.set('file',new File([png],'receipt.png',{type:'image/png'}));
 return new Request('https://example.invalid/api/customer-files',{method:'POST',body:form,headers:{'content-length':'500'}});
}
test('duplicate or ambiguous private blob must not become a finalized customer attachment',async()=>{
 for(const message of ['The resource already exists','Duplicate','Unknown storage failure']){
  const h=harness({message}),r=await h.post(input());
  assert.equal(r.status,503);
  assert.deepEqual(h.calls,['reserve_customer_file']);
  assert.equal((await r.json()).ok,undefined);
 }
});
test('successful private storage write may reach canonical finalize exactly once',async()=>{
 const h=harness(null),r=await h.post(input());
 assert.equal(r.status,200);
 assert.deepEqual(h.calls,['reserve_customer_file','finalize_customer_file']);
 assert.equal((await r.json()).file,file);
});
