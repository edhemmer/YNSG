import test from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {jobAction} from '../packages/contracts/operations.ts';
import {verifyJobActionResult,readJobRecovery,saveJobRecovery,clearJobRecovery,jobRecoveryKey} from '../apps/web/lib/job-action-recovery.ts';
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000002';
const body={organizationId:org,id,revision:3,action:'start',note:'',key:'test-job-action-0001'},entry={version:1,actor:'owner@example.invalid',body};
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('timer receipt must bind the exact job, next revision and requested transition',()=>{
 for(const action of ['start','pause','resume']){const c={...body,action},good={id,revision:4,status:action==='pause'?'paused':'working'};assert.deepEqual(verifyJobActionResult(good,c),good);
  for(const bad of [null,false,{}, {...good,id:other},{...good,revision:3},{...good,revision:5},{...good,status:action==='pause'?'working':'paused'},{...good,extra:'untrusted'}])assert.throws(()=>verifyJobActionResult(bad,c));
 }
});
test('device retry survives reload, stays actor-scoped and cannot be overwritten by another command',()=>{
 const device=store();saveJobRecovery(device,entry);assert.deepEqual(readJobRecovery(device,entry.actor),entry);assert.equal(readJobRecovery(device,'other@example.invalid'),null);
 assert.throws(()=>saveJobRecovery(device,{...entry,body:{...body,key:'test-job-action-0002'}}));saveJobRecovery(device,entry);clearJobRecovery(device,entry);assert.equal(readJobRecovery(device,entry.actor),null);
});
test('invalid/corrupt or unavailable recovery storage fails rather than becoming an empty retry',()=>{
 const device=store();for(const raw of ['{',JSON.stringify({...entry,actor:'other@example.invalid'}),JSON.stringify({...entry,body:{...body,note:'Customer private note'}}),'x'.repeat(3001)]){device.setItem(jobRecoveryKey(entry.actor),raw);assert.throws(()=>readJobRecovery(device,entry.actor));}
 const failed={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};assert.throws(()=>saveJobRecovery(failed,entry));
});
function api(result,error=null){
 const source=readFileSync('apps/web/app/api/jobs/route.ts','utf8').replace(/^import .*;\n/gm,'');const calls=[];
 const context={jobAction,verifyJobActionResult,Buffer,NextResponse:{json:(v,o)=>Response.json(v,o)},sameOrigin:()=>true,failure:()=>Response.json({error:'invalid'},{status:400}),authenticated:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return name==='production_workflows_ready'?{data:true,error:null}:{data:result,error};}}})};
 runInNewContext(stripTypeScriptTypes(source).replace(/^export /gm,'')+'\nthis.POST=POST',context);return {post:()=>context.POST(new Request('https://example.invalid/api/jobs',{method:'POST',body:JSON.stringify(body)})),calls};
}
test('timer API never confirms malformed or unrelated RPC success; rejected work gates stay definitive',async()=>{
 for(const bad of [false,{},null,{id:other,revision:4,status:'working'},{id,revision:3,status:'working'}]){const h=api(bad);assert.equal((await h.post()).status,503);assert.equal(h.calls[1].args.p_key,body.key);}
 for(const message of ['APPROVAL_REQUIRED','TIME_RECORD_REQUIRED'])assert.equal((await api(null,{message}).post()).status,409);
 const h=api({id,revision:4,status:'working'}),r=await h.post();assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,result:{id,revision:4,status:'working'}});
});
