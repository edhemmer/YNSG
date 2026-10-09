import test from 'node:test';import assert from 'node:assert/strict';import type {SupabaseClient} from '@supabase/supabase-js';
import {schedulingTravel} from '../apps/web/lib/scheduling-travel.js';
test('scheduling adds verified travel above the configured buffer, scopes by operator, and blocks impossible gaps',async()=>{
 const savedKey=process.env.GOOGLE_ROUTES_API_KEY,savedFetch=globalThis.fetch;process.env.GOOGLE_ROUTES_API_KEY='synthetic-only';
 let minutes=40;globalThis.fetch=async()=>Response.json({routes:[{duration:`${minutes*60}s`,distanceMeters:10000}]});
 const start=Date.parse('2099-10-15T15:00:00Z'),end=start+7200000;
 const previous={id:'prior',start_at:'2099-10-15T12:00:00Z',end_at:'2099-10-15T14:00:00Z',arrival_at:'2099-10-15T12:00:00Z',request:{original_submission:{street:'1 Prior St',city:'DeKalb IL'}}};
 const scoped:string[]=[];
 const responses:Record<string,unknown>={service_requests:{data:{original_submission:{street:'2 Next St',city:'DeKalb IL'}},error:null},resource_reservations:{data:[{appointment_id:'prior',resource_id:'operator'}],count:1,error:null},appointments:{data:[previous],count:1,error:null}};
 const db={from(table:string){const chain={select(){return chain;},eq(field:string,value:string){if(field==='organization_id')scoped.push(value);return chain;},in(field:string,values:string[]){if(field==='resource_id')assert.deepEqual(values,['operator']);return chain;},range(){return chain;},single(){return Promise.resolve(responses[table]);},then(resolve:(v:unknown)=>unknown){return Promise.resolve(responses[table]).then(resolve);}};return chain;}} as unknown as SupabaseClient;
 try{assert.deepEqual(await schedulingTravel(db,'tenant','request',null,['operator','equipment'],['operator'],start,end,'America/Chicago',30),{before:10,after:0,status:'verified'});assert.deepEqual(scoped,['tenant','tenant','tenant']);minutes=61;await assert.rejects(schedulingTravel(db,'tenant','request',null,['operator'],['operator'],start,end,'America/Chicago',30),/ROUTE_TRAVEL_CONFLICT/);delete process.env.GOOGLE_ROUTES_API_KEY;assert.equal((await schedulingTravel(db,'tenant','request',null,['operator'],['operator'],start,end,'America/Chicago',30)).status,'unavailable');}
 finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.GOOGLE_ROUTES_API_KEY;else process.env.GOOGLE_ROUTES_API_KEY=savedKey;}
});
