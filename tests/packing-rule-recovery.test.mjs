import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {z} from 'zod';
const organization='20000000-0000-4000-8000-000000000001';
const command={organization,service:'Lawn care',task:'Mowing',revision:2,items:[{name:'Mower',quantity:1,unit:'each',consumed:false}],key:'synthetic-packing-recovery-key'};
function harness({data={revision:3,saved:true},error=null,origin=true}={}){
 const calls=[];
 const raw=readFileSync('apps/web/app/api/packing-rules/route.ts','utf8').replace(/^import .*;\n/gm,'');
 const code=stripTypeScriptTypes(raw).replace(/^export /gm,'')+'\nexports.POST=POST;';
 const env={exports:{},z,Buffer,Error,NextResponse:{json:(d,o)=>new Response(JSON.stringify(d),o)},sameOrigin:()=>origin,authenticated:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return {data,error};}}}),failure:()=>new Response('{}',{status:503})};
 runInNewContext(code,env);return {...env.exports,calls};
}
const post=v=>new Request('https://example.invalid/api/packing-rules',{method:'POST',body:JSON.stringify(v)});
test('packing rules only confirm exact next-version receipt',async()=>{
 const h=harness();const r=await h.POST(post(command));assert.equal(r.status,200);assert.equal((await r.json()).result.revision,3);
 assert.equal(h.calls[0].args.p_key,command.key);
 for(const data of [null,{saved:true,revision:2},{saved:true,revision:4},{saved:false,revision:3},{saved:true,revision:3,extra:1}])assert.equal((await harness({data}).POST(post(command))).status,503);
});
test('ambiguous DB save remains unknown while stale/denied/duplicate are definite',async()=>{
 for(const [error,status] of [[{message:'Synthetic disconnected',code:'08006'},503],[{message:'STALE_REVISION',code:'P0001'},409],[{message:'DUPLICATE_EQUIPMENT',code:'P0001'},409],[{message:'FORBIDDEN',code:'42501'},403]]){
  const r=await harness({error}).POST(post(command));assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
  assert.ok(!(await r.text()).includes('Synthetic disconnected'));
 }
});
test('origin and input guards reject without database mutation',async()=>{
 const denied=harness({origin:false});assert.equal((await denied.POST(post(command))).status,403);assert.equal(denied.calls.length,0);
 const invalid=harness();assert.equal((await invalid.POST(post({...command,items:[{name:'Screw',quantity:0,unit:'each',consumed:true}]}))).status,400);assert.equal(invalid.calls.length,0);
});
test('packing UI freezes mutable controls and replays exact saved request',()=>{
 const source=readFileSync('apps/web/app/packing-rule-editor.tsx','utf8');
 for(const piece of ['retry.current.body','setUnknown(true)','useBlockedEntry','Check saved packing result','disabled={pending || locked || unknown || confirmed}'])assert.ok(source.includes(piece));
});
