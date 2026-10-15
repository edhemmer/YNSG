import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as contracts from '../apps/web/lib/invoice-record-contract.ts';
const organization='20000000-0000-4000-8000-000000000001',invoice='30000000-0000-4000-8000-000000000001';
const command={organization,invoice,revision:0,dueDate:'2026-10-30',archived:true,reason:'Synthetic agreed date',key:'80000000-0000-4000-8000-000000000001'};
const saved={revision:1,dueDate:command.dueDate,archived:true,reason:command.reason};
function harness(result={data:saved,error:null},origin=true){const calls=[];const raw=readFileSync(new URL('../apps/web/app/api/invoice-admin/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');const source=stripTypeScriptTypes(raw).replace(/^export /gm,'')+'\nexports.POST=POST;';const context={exports:{},...contracts,Error,Buffer,NextResponse:{json:(data,options)=>new Response(JSON.stringify(data),options)},sameOrigin:()=>origin,authenticated:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return result;}}})};runInNewContext(source,context);return {...context.exports,calls};}
const post=value=>new Request('https://example.invalid/api/invoice-admin',{method:'POST',body:typeof value==='string'?value:JSON.stringify(value)});
test('invoice record rejects wrong origin, malformed/oversized input and invalid revisions before a command',async()=>{
 const denied=harness(undefined,false);assert.equal((await denied.POST(post(command))).status,403);assert.equal(denied.calls.length,0);
 const h=harness();for(const value of ['{', {...command,unknown:true},{...command,revision:0.5},{...command,revision:2147483647},{...command,dueDate:'not-a-date'},{...command,dueDate:'0000-01-01'},{...command,reason:'Bad\u0000reason'},{...command,key:'80000000-0000-4000\u0000'},{...command,reason:'x'}])assert.equal((await h.POST(post(value))).status,400);
 assert.equal((await h.POST(post(' '.repeat(4097)))).status,413);assert.equal(h.calls.length,0);
});
test('unknown invoice record database outcomes stay uncertain; only named rejections are definitive',async()=>{
 for(const [message,status] of [['STALE_REVISION',409],['IDEMPOTENCY_CONFLICT',409],['FORBIDDEN',403],['synthetic transport lost after commit',503]]){const h=harness({data:null,error:{message}}),r=await h.POST(post(command));assert.equal(r.status,status);assert.equal(h.calls[0].name,'manage_invoice');assert.equal(h.calls[0].args.p_key,command.key);assert.equal(h.calls[0].args.p_revision,0);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.ok(!(await r.text()).includes('synthetic transport'));}
});
test('saved invoice record response must match the exact reviewed change',async()=>{
 for(const data of [{revision:1},{...saved,dueDate:null},{...saved,archived:false},{...saved,revision:2},{...saved,reason:'Different'}])assert.equal((await harness({data,error:null}).POST(post(command))).status,503);
 const r=await harness().POST(post(command));assert.equal(r.status,200);assert.deepEqual(await r.json(),saved);
});
