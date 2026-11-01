import test from 'node:test';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';import {runInNewContext} from 'node:vm';import {readFileSync} from 'node:fs';
import {messageQuery,messageQueue} from '../apps/web/lib/notification-contract.ts';import {mailAttentionKinds,mailAttentionDueFilter} from '../apps/web/lib/notification-attention.ts';
const org='20000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000002',requestId='20000000-0000-4000-8000-000000000003';
const row={id,kind:'appointment.confirmation',status:'accepted',object_id:id,created_at:'2026-11-01T06:30:00Z',next_attempt_at:'2026-11-01T06:30:00Z',lease_until:null,attempts:1};
function harness({rows=[row],count=rows.length,denied=false,authError=false,lookupError=false}={}){
 const calls=[];const db={rpc:async()=>({data:{enabled:true},error:denied?{}:null}),from(table){const query={};for(const method of ['select','eq','in','or','order','range'])query[method]=(...args)=>{calls.push({table,method,args});return query};query.then=resolve=>resolve(table==='outbox'?{data:rows,count,error:null}:{data:[{id,request_id:requestId}],error:lookupError?{}:null});return query}};
 const context={Error,URL,Map,Set,Object,Date,messageQuery,messageQueue,mailAttentionKinds,mailAttentionDueFilter,NextResponse:{json:(v,o)=>Response.json(v,o)},authenticated:async()=>{if(authError)throw Error('UNAUTHORIZED');return {db}},failure:()=>Response.json({error:'Sign in required'},{status:401}),mailTransport:async()=>({provider:'resend'}),mailDeliveryReady:()=>true,process:{env:{}}};
 const source=readFileSync('apps/web/app/api/notification-attention/route.ts','utf8').replace(/^import .*;\r?\n/gm,'');runInNewContext(stripTypeScriptTypes(source).replace(/^export /gm,'')+'\nthis.get=GET;',context);
 return {calls,get:(query='&view=recent')=>context.get(new Request('https://example.invalid/api/notification-attention?organization='+org+query))};
}
test('message activity requires live owner permission and rejects invalid bounded queries',async()=>{
 for(const [options,status] of [[{denied:true},403],[{authError:true},401]]){const h=harness(options);assert.equal((await h.get()).status,status);assert.equal(h.calls.length,0)}
 for(const query of ['&view=bad','&page=-1','&page=100001','&extra=true']){const h=harness();assert.equal((await h.get(query)).status,400);assert.equal(h.calls.length,0)}
});
test('recent history is private, newest first and binds appointment navigation to this company',async()=>{
 const h=harness(),response=await h.get(),body=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(body.organization,org);assert.equal(body.view,'recent');assert.equal(body.records[0].request_id,requestId);assert.equal(body.records[0].status,'accepted');
 assert.ok(h.calls.some(c=>c.table==='appointments'&&c.method==='eq'&&c.args[0]==='organization_id'&&c.args[1]===org));assert.ok(h.calls.some(c=>c.method==='order'&&c.args[1].ascending===false));assert.ok(h.calls.some(c=>c.method==='or'&&c.args[0].includes('schemaVersion.eq.2')));assert.equal('payload' in body.records[0],false);
});
test('attention keeps due/reconciliation filter and oldest-first ordering',async()=>{const h=harness({rows:[{...row,kind:'request.customer_receipt',status:'pending'}]});const response=await h.get('');assert.equal(response.status,200);assert.ok(h.calls.some(c=>c.method==='order'&&c.args[1].ascending===true));assert.ok(h.calls.some(c=>c.method==='or'&&c.args[0].includes('needs_reconciliation')));assert.equal((await response.json()).records[0].request_id,id)});
test('incomplete pages, invalid records and relationship lookup failures cannot become success',async()=>{for(const options of [{count:2},{rows:[{...row,id:'bad'}]},{lookupError:true}])assert.equal((await harness(options).get()).status,503)});
