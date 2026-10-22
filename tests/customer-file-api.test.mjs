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
const validImage=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
function harness(uploadError,storedBytes=validImage){
 const calls=[];
 const db={rpc:async(name)=>{
  calls.push(name);
  if(name==='reserve_customer_file')return {data:{id:file,path:org+'/'+file,ready:false},error:null};
  if(name==='verified_customer_file_access')return {data:{path:org+'/'+file,name:'receipt.png',mime:'image/png',bytes:validImage.length,sha256:createHash('sha256').update(validImage).digest('hex')},error:null};
  return {data:[],error:null};
 },storage:{from:()=>({createSignedUrl:async()=>{calls.push('signed');return {data:{signedUrl:'https://storage.example.invalid/sample'},error:null};},upload:async()=>({error:uploadError}),download:async()=>{calls.push('download');return {data:new Blob([storedBytes]),error:null};}})}};
 const NextResponse={json:(data,options={})=>new Response(JSON.stringify(data),{status:options.status||200,headers:options.headers})};
 const imports={createHash,z,NextResponse,authenticated:async()=>({db,user:{id:customer},access:'validated-access'}),verifiedFileSession:()=>customer,confirmVerifiedCustomerFile:async()=>{calls.push('confirm_verified_customer_file');return {data:{id:file,ready:true},error:null};},sameOrigin:()=>true,failure:()=>NextResponse.json({error:'error'},{status:503}),...contract};
 let code=src.split('\n').filter(line=>!line.startsWith('import ')&&!line.startsWith('export const dynamic')).join('\n');
 code=stripTypeScriptTypes(code.replace(/^export /gm,''))+'\nexports.POST=POST;exports.GET=GET;';
 const scope={...imports,exports:{},Buffer,File,FormData,Uint8Array,Request,Response,URL};
 runInNewContext(code,scope);
 return {post:scope.exports.POST,get:scope.exports.GET,calls};
}
function input(){
 const png=validImage;
 const form=new FormData();form.set('organization',org);form.set('customer',customer);form.set('key','50000000-0000-4000-8000-000000000001');form.set('purpose','receipt');form.set('file',new File([png],'receipt.png',{type:'image/png'}));
 return new Request('https://example.invalid/api/customer-files',{method:'POST',body:form,headers:{'content-length':'500'}});
}
test('storage error never promotes an unknown blob',async()=>{
 const h=harness({message:'Unknown storage failure'}),r=await h.post(input());
 assert.equal(r.status,503);
 assert.deepEqual(h.calls,['reserve_customer_file']);
});
test('same-byte duplicate after lost response may be reconciled once',async()=>{
 for(const message of ['The resource already exists','Duplicate']){
  const h=harness({message}),r=await h.post(input());
  assert.equal(r.status,200);assert.deepEqual(h.calls,['reserve_customer_file','download','confirm_verified_customer_file']);
 }
});
test('wrong object bytes or altered size cannot be finalized',async()=>{
 for(const bytes of [Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,5]),new Uint8Array(50)]){
  const h=harness({message:'Duplicate'},bytes),r=await h.post(input());
  assert.equal(r.status,409);assert.deepEqual(h.calls,['reserve_customer_file','download']);
 }
});
test('successful private storage write may reach canonical finalize exactly once',async()=>{
 const h=harness(null),r=await h.post(input());
 assert.equal(r.status,200);
 assert.deepEqual(h.calls,['reserve_customer_file','download','confirm_verified_customer_file']);
 assert.equal((await r.json()).file,file);
});

test('file download verifies frozen digest before creating a short-lived signed link',async()=>{
 for(const valid of [true,false]){const h=harness(null,valid?validImage:Uint8Array.from([...validImage.slice(0,-1),5]));const r=await h.get(new Request('https://example.invalid/api/customer-files?'+new URLSearchParams({organization:org,file})));assert.equal(r.status,valid?200:409);assert.deepEqual(h.calls,valid?['verified_customer_file_access','download','signed']:['verified_customer_file_access','download']);}
});

test('oversized images are rejected before reserving or uploading',async()=>{
 const form=new FormData();form.set('organization',org);form.set('customer',customer);form.set('key','50000000-0000-4000-8000-000000000001');form.set('purpose','receipt');form.set('file',new File([new Uint8Array(4194305)],'large.png',{type:'image/png'}));
 const h=harness(null),r=await h.post(new Request('https://example.invalid/api/customer-files',{method:'POST',body:form,headers:{'content-length':'4195000'}}));
 assert.equal(r.status,400);assert.deepEqual(h.calls,[]);
 const tooLarge=await h.post(new Request('https://example.invalid/api/customer-files',{method:'POST',body:'x',headers:{'content-length':'4500001'}}));
 assert.equal(tooLarge.status,413);assert.deepEqual(h.calls,[]);
});
