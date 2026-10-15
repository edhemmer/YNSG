import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as contracts from '../apps/web/lib/customer-record-contract.ts';
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',key='80000000-0000-4000-8000-000000000001';
function harness(rpcResult={data:null,error:null},allow=true){const calls=[];const raw=readFileSync(new URL('../apps/web/app/api/customer-records/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');const source=stripTypeScriptTypes(raw).replace(/^export /gm,'')+'\nexports.GET=GET;exports.POST=POST;';const context={exports:{},...contracts,Error,Buffer,URL,NextResponse:{json:(data,options)=>new Response(JSON.stringify(data),options)},sameOrigin:()=>allow,authenticated:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return rpcResult;}}})};runInNewContext(source,context);return {...context.exports,calls};}
const command={organization:org,key,action:'create_customer',value:{displayName:'Synthetic customer'},reason:''};
const post=body=>new Request('https://example.invalid/api/customer-records',{method:'POST',headers:{origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify(body)});
test('customer endpoint rejects origin, unknown fields and invalid revisions before calling the database',async()=>{
 const origin=harness(undefined,false);assert.equal((await origin.POST(post(command))).status,403);assert.equal(origin.calls.length,0);
 const h=harness();assert.equal((await h.POST(post({...command,serviceRole:true}))).status,400);assert.equal(h.calls.length,0);
 assert.equal((await h.GET(new Request('https://example.invalid/api/customer-records?organization=bad'))).status,400);assert.equal(h.calls.length,0);
 assert.equal(contracts.customerCommand.safeParse({...command,action:'update_customer',customer:id,revision:1e12}).success,false);
 assert.equal(contracts.customerCommand.safeParse({organization:org,key,action:'save_contact',customer:id,revision:1,record:id,recordRevision:null,value:{name:'Contact',email:'',phone:'5550100999',relationship:'Customer'},reason:''}).success,false);
});
test('customer endpoint distinguishes definitive conflicts and access denials from uncertain database/output results',async()=>{
 for(const [message,status] of [['STALE_REVISION',409],['FORBIDDEN',403],['synthetic connection lost after commit',503]]){const h=harness({data:null,error:{message}}),r=await h.POST(post(command));assert.equal(r.status,status);assert.equal(h.calls[0].name,'manage_customer_record');assert.equal(h.calls[0].args.p_org,org);assert.equal(h.calls[0].args.p_key,key);assert.ok(!Object.hasOwn(h.calls[0].args.p_input,'organization'));}
 const h=harness({data:{saved:true},error:null});assert.equal((await h.POST(post(command))).status,503,'Malformed successful output never becomes an editable definitive failure');
 const ok=harness({data:{saved:true,customerId:id,revision:1,recordId:id,recordRevision:1},error:null}),r=await ok.POST(post(command));assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal((await r.json()).customerId,id);
});
test('customer reads are bounded and strict, and phone-only contacts remain supported without identity grants',async()=>{
 const h=harness({data:{items:[],hasMore:false,page:2},error:null});const r=await h.GET(new Request('https://example.invalid/api/customer-records?'+new URLSearchParams({organization:org,page:'2',query:'phone'})));assert.equal(r.status,200);assert.equal(h.calls[0].name,'owner_customer_records');assert.equal(h.calls[0].args.p_page,2);
 assert.equal(contracts.contactValue.safeParse({name:'Synthetic phone customer',email:'',phone:'5550100999',relationship:'Customer'}).success,true);assert.equal(contracts.contactValue.safeParse({name:'Synthetic',email:'',phone:'',relationship:'Customer'}).success,false);
 assert.equal(contracts.contactValue.safeParse({name:'Synthetic',email:'',phone:'--- ---',relationship:'Customer'}).success,false);assert.equal(contracts.customerQuery.safeParse({organization:org,page:10001}).success,false);assert.equal(contracts.customerQuery.safeParse({organization:org,query:'<script>'}).success,false);
});
