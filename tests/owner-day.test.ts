import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerDayQuery,ownerDayResponse,ownerDayLabel,ownerStopDirections,ownerStopCall} from '../apps/web/lib/owner-day.ts';
import {readOwnerDay} from '../apps/web/lib/owner-day-read.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
const call={id:'10000000-0000-4000-8000-000000000001',requestId:'10000000-0000-4000-8000-000000000002',startAt:'2030-10-16T13:00:00Z',arrivalAt:'2030-10-16T14:00:00Z',endAt:'2030-10-16T17:00:00Z',name:'Synthetic',address:'Test address',phone:'5550100',tasks:['Assembly']};
test('owner Today uses business timezone rather than device UTC day and preserves pickup start',()=>{
 assert.equal(ownerDayLabel(call,'America/Chicago',new Date('2030-10-17T00:30:00Z')),'Today');
 assert.equal(ownerDayLabel(call,'America/Chicago',new Date('2030-10-17T12:00:00Z')),'Upcoming');
 const parsed=ownerDayResponse.parse({checkedAt:'2030-10-16T12:00:00Z',timezone:'America/Chicago',calls:[call],hasMore:true});
 assert.notEqual(parsed.calls[0]!.startAt,parsed.calls[0]!.arrivalAt);assert.equal(parsed.hasMore,true);
});
function readerFixture(access:boolean,broken=false){
 const operations:{table:string;method:string;args:unknown[]}[]=[];
 const row={id:call.id,request_id:call.requestId,start_at:call.startAt,arrival_at:call.arrivalAt,end_at:call.endAt,request:{original_submission:{name:call.name,street:'Test',city:'DeKalb',phone:call.phone,services:[{service:'Assembly',task:'Furniture'}]}}};
 const results:Record<string,unknown>={memberships:{data:access?{role:'owner'}:null,error:null},organizations:{data:{timezone:'America/Chicago'},error:null},appointments:{data:broken?[{...row,request:null}]:Array.from({length:13},(_,i)=>({...row,id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0')})),error:null}};
 const db={from(table:string){const query:Record<string,unknown>={then(resolve:(v:unknown)=>unknown){return Promise.resolve(results[table]).then(resolve);}};for(const method of ['select','eq','is','in','not','gte','order','range','single','maybeSingle'])query[method]=(...args:unknown[])=>{operations.push({table,method,args});return query;};return query;}};
 return {db:db as unknown as SupabaseClient,operations};
}
test('owner day enforces owner membership before data reads and scopes bounded schedule queries',async()=>{
 const denied=readerFixture(false);await assert.rejects(()=>readOwnerDay(denied.db,call.id,call.requestId),/OWNER_ACCESS_REQUIRED/);assert.ok(denied.operations.every(v=>v.table==='memberships'));
 const fixture=readerFixture(true);const result=await readOwnerDay(fixture.db,call.id,call.requestId,'2030-10-16T12:00:00Z');
 assert.equal(result.calls.length,12);assert.equal(result.hasMore,true);assert.equal(result.calls[0]!.tasks[0],'Furniture');
 assert.ok(fixture.operations.some(v=>v.table==='appointments'&&v.method==='range'&&JSON.stringify(v.args)==='[0,12]'));
 assert.ok(fixture.operations.some(v=>v.table==='appointments'&&v.method==='eq'&&JSON.stringify(v.args)==='["status","reserved"]'));
 for(const table of ['memberships','appointments'])assert.ok(fixture.operations.some(v=>v.table===table&&v.method==='eq'&&v.args[0]==='organization_id'&&v.args[1]===call.id));
 assert.ok(fixture.operations.some(v=>v.method==='is'&&v.args[0]==='revoked_at'));
 await assert.rejects(()=>readOwnerDay(readerFixture(true,true).db,call.id,call.requestId),/FAILED/);
});
test('owner day contracts reject unbounded lists, malformed dates and mutation inputs',()=>{
 assert.equal(ownerDayQuery.safeParse({organization:call.id,approve:true}).success,false);
 const data={checkedAt:'2030-10-16T12:00:00Z',timezone:'America/Chicago',calls:[call],hasMore:false};
 assert.equal(ownerDayResponse.safeParse({...data,calls:Array(13).fill(call)}).success,false);
 assert.equal(ownerDayResponse.safeParse({...data,calls:[{...call,arrivalAt:'yesterday'}]}).success,false);
 assert.equal(ownerDayResponse.safeParse({...data,calls:[{...call,token:'private'}]}).success,false);
});

test('field shortcuts produce safe user-invoked call and navigation links',()=>{
 assert.equal(ownerStopDirections(' 123 Main St, DeKalb IL '),'https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20DeKalb%20IL');
 assert.equal(ownerStopDirections('  '),null);
 assert.equal(ownerStopDirections('x'.repeat(501)),null);
 assert.equal(ownerStopCall('(815) 555-0100'),'tel:8155550100');
 assert.equal(ownerStopCall('+1 815 555 0100'),'tel:+18155550100');
 assert.equal(ownerStopCall('not a number'),null);
 assert.equal(ownerStopCall('555'),null);
});
