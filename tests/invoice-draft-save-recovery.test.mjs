import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';
const org='20000000-0000-4000-8000-000000000001',job='30000000-0000-4000-8000-000000000001';
const command={organization:org,job,revision:4,key:'synthetic-invoice-draft-key',lines:[{description:'Work completed',recordedMinutes:90,chargedCents:12000,waiverReason:''}]};
function harness({data={revision:5,totalCents:12000},error=null,origin=true}={}){
 const calls=[];const raw=readFileSync('apps/web/app/api/invoice-draft/route.ts','utf8').replace(/^import .*;\n/gm,'');
 const code=stripTypeScriptTypes(raw).replace(/^export /gm,'')+'\nexports.POST=POST;';
 const context={exports:{},z,Buffer,URL,Error,NextResponse:{json:(d,o)=>new Response(JSON.stringify(d),o)},sameOrigin:()=>origin,authenticated:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return {data,error};}}}),parseInvoiceDraft:raw=>JSON.parse(raw),failure:()=>new Response('{}',{status:503})};
 runInNewContext(code,context);return {...context.exports,calls};
}
const post=()=>new Request('https://example.invalid/api/invoice-draft',{method:'POST',body:JSON.stringify(command)});
test('saved draft receipt requires exactly the next job revision and real cents',async()=>{
 const h=harness(),r=await h.POST(post());assert.equal(r.status,200);assert.equal((await r.json()).result.revision,5);
 assert.equal(h.calls[0].args.p_key,command.key);
 for(const data of [null,{revision:4,totalCents:12000},{revision:6,totalCents:12000},{revision:5,totalCents:'12000'},{revision:5}])assert.equal((await harness({data}).POST(post())).status,503);
});
test('uncertain SQL outcomes are never labeled as definitely not saved',async()=>{
 for(const [error,status] of [[{code:'08006',message:'Synthetic connection lost'},503],[{code:'P0001',message:'STALE_REVISION'},409],[{code:'P0001',message:'CHANGE_ORDER_REQUIRED'},409],[{code:'42501',message:'FORBIDDEN'},403]]){
  const r=await harness({error}).POST(post());assert.equal(r.status,status);
  assert.equal(r.headers.get('Cache-Control'),'private, no-store');
  assert.ok(!(await r.text()).includes('Synthetic connection lost'));
 }
});
test('client draft locks unknown save, replays exact body and allows normal editing after confirmation',()=>{
 const s=readFileSync('apps/web/app/invoice-draft.tsx','utf8');
 for(const line of ['body:attempt.body','setDraftUnknown(true)','Check saved draft result','useBlockedEntry','draftUnknown || completionUncertain'])assert.ok(s.includes(line));
});
