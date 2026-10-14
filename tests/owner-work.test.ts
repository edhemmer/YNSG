import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readOwnerWork} from '../apps/web/lib/owner-work-read.ts';
import {ownerWorkQuery} from '../apps/web/lib/owner-work.ts';
const uuid=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(allowed=true,missing=false){
 const operations:{table:string;method:string;args:unknown[]}[]=[];
 const results:Record<string,unknown>={memberships:{data:allowed?{role:'owner'}:null,error:null},jobs:{data:Array.from({length:21},(_,i)=>({id:uuid(i+1),quote_id:uuid(i+100),status:'completed'})),count:45,error:null},quotes:{data:Array.from({length:20},(_,i)=>({id:uuid(i+100),request_id:uuid(i+200)})),error:null},service_requests:{data:missing?[]:Array.from({length:20},(_,i)=>({id:uuid(i+200),original_submission:{name:'Synthetic '+i,street:'Test',city:'DeKalb',service:'Assembly'}})),error:null}};
 const db={from(table:string){const query:Record<string,unknown>={then(resolve:(v:unknown)=>unknown){return Promise.resolve(results[table]).then(resolve);}};for(const method of ['select','eq','is','in','order','range','limit','maybeSingle'])query[method]=(...args:unknown[])=>{operations.push({table,method,args});return query;};return query;}};
 return {db:db as unknown as SupabaseClient,operations};
}
test('unfinished work is tenant-scoped, unbilled and paginated independently of request age',async()=>{
 const f=fixture(),result=await readOwnerWork(f.db,uuid(500),uuid(600),2);
 assert.equal(result.items.length,20);assert.equal(result.total,45);assert.equal(result.hasMore,true);assert.equal(result.page,2);assert.equal(result.items[0]!.request,uuid(200));
 assert.ok(f.operations.some(v=>v.table==='jobs'&&v.method==='is'&&JSON.stringify(v.args)==='["invoices","null"]'));
 assert.ok(f.operations.some(v=>v.table==='jobs'&&v.method==='range'&&JSON.stringify(v.args)==='[40,60]'));
 assert.ok(f.operations.some(v=>v.table==='jobs'&&v.method==='order'&&v.args[0]==='created_at'));
 for(const table of ['jobs','quotes','service_requests'])assert.ok(f.operations.some(v=>v.table===table&&v.method==='eq'&&v.args[0]==='organization_id'&&v.args[1]===uuid(500)));
 assert.ok(!f.operations.some(v=>v.method==='gte'||v.method==='insert'||v.method==='update'));
});
test('unfinished work denies revoked or non-owner access before reading private jobs and fails incomplete joins',async()=>{
 const denied=fixture(false);await assert.rejects(()=>readOwnerWork(denied.db,uuid(500),uuid(600),0),/OWNER_ACCESS_REQUIRED/);assert.ok(denied.operations.every(v=>v.table==='memberships'));
 await assert.rejects(()=>readOwnerWork(fixture(true,true).db,uuid(500),uuid(600),0),/FAILED/);
 assert.equal(ownerWorkQuery.safeParse({organization:uuid(500),page:-1}).success,false);assert.equal(ownerWorkQuery.safeParse({organization:uuid(500),page:100001}).success,false);assert.equal(ownerWorkQuery.safeParse({organization:uuid(500),approve:true}).success,false);
});
