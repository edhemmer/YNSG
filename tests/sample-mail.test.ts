import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {dispatchSampleMail} from '../apps/web/lib/sample-mail.ts';
import {productionSamples} from '../apps/web/lib/production-samples.ts';
const org='00000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000003',run='00000000-0000-4000-8000-000000000002';
const settings={displayName:'Synthetic',notificationRecipient:'owner@example.invalid',sender:'owner@example.invalid'};
function fixture(){
 const suite=productionSamples(settings,org,settings.sender,'https://crm.example.invalid',run);
 const items=[{id:'00000000-0000-4000-8000-000000000004',organization_id:org,object_id:run,kind:'diagnostic.template_preview',status:'pending',payload:{actor,template:suite.messages[0]!.id,recipient:settings.sender}}, {id:run,organization_id:org,kind:'diagnostic.sample_suite',status:'suppressed',payload:{actor,suite}}];
 let owner=true,race=false;
 const db={from(table:string){let patch:Record<string,unknown>|null=null,one=false;const filters:((r:any)=>boolean)[]=[];let maximum=100;
 const q:any={select(){return q},update(p:Record<string,unknown>){patch=p;return q},eq(k:string,v:unknown){filters.push(r=>r[k]===v);return q},is(){return q},in(){return q},order(){return q},limit(n:number){maximum=n;return q},single(){one=true;return q},maybeSingle(){one=true;return q},then(resolve:(x:unknown)=>void){
 if(table==='memberships')return Promise.resolve(resolve({error:null,data:owner?{role:'owner'}:null}));
 const rows=items.filter(r=>filters.every(f=>f(r))).slice(0,maximum);
 if(patch&&race){race=false;return Promise.resolve(resolve({error:null,data:[]}));}
 if(patch)for(const r of rows)Object.assign(r,patch);
 return Promise.resolve(resolve({error:null,data:one?rows[0]||null:rows}));}};return q;}} as unknown as SupabaseClient;
 return {db,items,revoke(){owner=false},race(){race=true}};
}
test('background samples persist provider acceptance and do not send a second time',async()=>{
 const f=fixture();let calls=0;const transport:typeof fetch=async()=>{calls++;return new Response('{"id":"synthetic-provider-id"}')};
 const result=await dispatchSampleMail(org,f.db,'synthetic-token',settings.sender,settings,3,transport);
 assert.equal(result[0]?.status,'accepted');assert.equal(f.items[0]!.status,'accepted');
 await dispatchSampleMail(org,f.db,'synthetic-token',settings.sender,settings,3,transport);assert.equal(calls,1);
});
test('revoked owner or changed recipient suppresses delivery before contacting Gmail',async()=>{
 for(const changedRecipient of [false,true]){const f=fixture();if(!changedRecipient)f.revoke();let calls=0;
 await dispatchSampleMail(org,f.db,'synthetic-token',settings.sender,{...settings,...(changedRecipient?{notificationRecipient:'changed@example.invalid'}:{})},3,async()=>{calls++;return new Response('{}')});
 assert.equal(calls,0);assert.equal(f.items[0]!.status,'suppressed');}
});
test('failed compare-and-set sends nothing; unknown Gmail outcomes are retained without retry',async()=>{
 const f=fixture();f.race();let calls=0;const transport:typeof fetch=async()=>{calls++;throw Error('synthetic timeout')};
 await dispatchSampleMail(org,f.db,'synthetic-token',settings.sender,settings,3,transport);assert.equal(calls,0);
 await dispatchSampleMail(org,f.db,'synthetic-token',settings.sender,settings,3,transport);assert.equal(calls,1);assert.equal(f.items[0]!.status,'needs_reconciliation');
 await dispatchSampleMail(org,f.db,'synthetic-token',settings.sender,settings,3,transport);assert.equal(calls,1);
});
