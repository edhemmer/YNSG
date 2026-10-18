import test from 'node:test';import assert from 'node:assert/strict';
import {buildRoutePlan,dayRouteUrls} from '../apps/web/lib/route-plan.js';
import {googleRouteProvider} from '../apps/web/lib/google-routes.js';
import type {DayCall} from '../apps/web/lib/day-plan.js';
const call=(id:string,start:string,end:string):DayCall=>({id,requestId:id,startAt:start,arrivalAt:start,endAt:end,status:'reserved',customerResponse:'confirmed',name:id,phone:'',email:'',address:id+' Street, DeKalb IL',tasks:[],workItems:[],description:''});
const calls=[call('A','2026-10-15T13:00:00Z','2026-10-15T15:00:00Z'),call('B','2026-10-15T15:10:00Z','2026-10-15T17:10:00Z'),call('C','2026-10-15T17:40:00Z','2026-10-15T19:40:00Z')];
test('route identifies travel shortfalls and nearby stops separated by a detour without changing appointments',async()=>{const snapshot=JSON.stringify(calls),departures:string[]=[];const plan=await buildRoutePlan(calls,async(from,to,departure)=>{departures.push(departure);return {minutes:from.startsWith('A')&&to.startsWith('C')?2:20,meters:from.startsWith('A')&&to.startsWith('C')?300:5000};},new Date('2026-10-09T00:00Z'));assert.equal(plan.legs[0]?.lateMinutes,10);assert.equal(plan.complete,false);assert.ok(plan.warnings.some(w=>w.includes('insufficient driving time')));assert.equal(plan.legs[1]?.lateMinutes,0);assert.deepEqual(plan.grouping,[{firstId:'A',nearbyId:'C',betweenId:'B'}]);assert.ok(departures.includes(calls[0]!.endAt));assert.equal(JSON.stringify(calls),snapshot);});
test('no fabricated times with missing provider, missing address, historical departures or supplier pickup',async()=>{for(const input of [calls,calls.map(c=>({...c,address:''})),calls.map(c=>({...c,arrivalAt:new Date(Date.parse(c.startAt)+60000).toISOString()}))]){const p=await buildRoutePlan(input,null,new Date('2026-10-09'));assert.equal(p.complete,false);assert.equal(p.legs[0]?.minutes,null);}let used=false;const past=await buildRoutePlan(calls,async()=>{used=true;return {minutes:3,meters:10};},new Date('2026-10-20'));assert.equal(used,false);assert.equal(past.complete,false);});
test('mobile Maps segments preserve all stops in order with no excessive waypoints',()=>{const visits=Array.from({length:11},(_,i)=>({address:`${i} Main St`})),urls=dayRouteUrls(visits);assert.equal(urls.length,3);for(const value of urls){const u=new URL(value);assert.ok((u.searchParams.get('waypoints')?.split('|').length||0)<=3);}const stops=urls.flatMap(v=>{const p=new URL(v).searchParams;return [p.get('origin'),...(p.get('waypoints')?.split('|')||[]),p.get('destination')].filter(Boolean);});assert.deepEqual([...new Set(stops)],visits.map(v=>v.address));assert.deepEqual(dayRouteUrls([{address:''}]),[]);});
test('Google provider requests real scheduled departure and rejects malformed or denied estimates',async()=>{let body:Record<string,unknown>={};const send=async(_url:URL|RequestInfo,init?:RequestInit)=>{body=JSON.parse(String(init?.body));return Response.json({routes:[{duration:'1200s',distanceMeters:5000}]});};const provider=googleRouteProvider('synthetic-key',send,async()=>true)!;assert.deepEqual(await provider('A','B',calls[0]!.endAt),{minutes:20,meters:5000});assert.equal(body.departureTime,calls[0]!.endAt);assert.equal(body.routingPreference,'TRAFFIC_AWARE_OPTIMAL');assert.equal(googleRouteProvider(''),null);await assert.rejects(googleRouteProvider('synthetic-key',async()=>Response.json({routes:[]}),async()=>true)!('A','B',calls[0]!.endAt));});

test('single-stop navigation and two-stop directions use explicit locations',()=>{const one=dayRouteUrls([{address:'298 Quinlan Ave, DeKalb, IL 60115'}]);assert.equal(one.length,1);assert.equal(new URL(one[0]!).searchParams.get('destination'),'298 Quinlan Ave, DeKalb, IL 60115');const two=dayRouteUrls([{address:'1 Main St, DeKalb, IL'},{address:'2 Main St, Sycamore, IL'}]);const url=new URL(two[0]!);assert.equal(url.searchParams.get('origin'),'1 Main St, DeKalb, IL');assert.equal(url.searchParams.get('destination'),'2 Main St, Sycamore, IL');});
test('same-property consecutive visits have zero travel without an external route provider',async()=>{const visits=[call('A','2099-10-15T13:00:00Z','2099-10-15T15:00:00Z'),call('B','2099-10-15T15:10:00Z','2099-10-15T17:10:00Z')].map(c=>({...c,address:'298 Quinlan Ave, DeKalb, IL 60115'}));const plan=await buildRoutePlan(visits,null,new Date('2099-10-01'));assert.equal(plan.complete,true);assert.equal(plan.legs[0]?.minutes,0);assert.equal(plan.legs[0]?.lateMinutes,0);});

test('overlapping confirmed visits never appear as a complete daily route',async()=>{const visits=[call('A','2099-10-15T13:00:00Z','2099-10-15T16:00:00Z'),call('B','2099-10-15T15:00:00Z','2099-10-15T17:00:00Z')];const plan=await buildRoutePlan(visits,async()=>({minutes:0,meters:0}),new Date('2099-10-01'));assert.equal(plan.complete,false);assert.ok(plan.warnings.some(w=>w.includes('overlap')));assert.equal(plan.legs[0]?.minutes,null);});

test('route is not ready while visits need review or a confirmed destination lacks city',async()=>{const a=call('A','2099-10-15T13:00:00Z','2099-10-15T15:00:00Z');const pending=await buildRoutePlan([{...a,status:'needs_review'}],null,new Date('2099-10-01'));assert.equal(pending.complete,false);const incomplete=await buildRoutePlan([{...a,address:'298 Quinlan Ave'}],null,new Date('2099-10-01'));assert.equal(incomplete.complete,false);assert.deepEqual(incomplete.mapsUrls,[]);});

test('a single confirmed visit with invalid times is not route ready',async()=>{const a=call('A','2099-10-15T15:00:00Z','2099-10-15T13:00:00Z');const plan=await buildRoutePlan([a],null,new Date('2099-10-01'));assert.equal(plan.complete,false);assert.deepEqual(plan.mapsUrls,[]);assert.ok(plan.warnings.some(w=>w.includes('invalid appointment times')));});


test('single confirmed supplier pickup requires location even without neighboring stops',async()=>{
 const a=call('A','2099-10-15T13:00:00Z','2099-10-15T15:00:00Z');
 const plan=await buildRoutePlan([{...a,arrivalAt:'2099-10-15T12:30:00Z'}],null,new Date('2099-10-01'));
 assert.equal(plan.complete,false);
 assert.deepEqual(plan.mapsUrls,[]);
 assert.ok(plan.warnings.some(w=>w.includes('Supplier pickup')));
});

test('route directions and travel legs follow scheduled start times even if API rows arrive out of order',async()=>{
 const a=call('A','2099-10-15T13:00:00Z','2099-10-15T15:00:00Z');
 const b=call('B','2099-10-15T16:00:00Z','2099-10-15T18:00:00Z');
 const plan=await buildRoutePlan([b,a],async()=>({minutes:10,meters:1000}),new Date('2099-10-01'));
 assert.equal(plan.legs[0]?.fromId,'A');
 assert.equal(plan.legs[0]?.toId,'B');
 assert.equal(new URL(plan.mapsUrls[0]!).searchParams.get('origin'),a.address);
});


test('invalid duration on either neighboring visit prevents provider calls',async()=>{
 const valid=call('A','2099-10-15T13:00:00Z','2099-10-15T15:00:00Z');
 const later=call('B','2099-10-15T16:00:00Z','2099-10-15T18:00:00Z');
 for(const visits of [[{...valid,endAt:'2099-10-15T12:00:00Z'},later],[valid,{...later,endAt:'2099-10-15T15:30:00Z'}]]){
  let calls=0;
  const plan=await buildRoutePlan(visits,async()=>{calls++;return {minutes:5,meters:1000};},new Date('2099-10-01'));
  assert.equal(calls,0);
  assert.equal(plan.complete,false);
  assert.equal(plan.legs[0]?.minutes,null);
  assert.deepEqual(plan.mapsUrls,[]);
  assert.ok(plan.legs[0]?.reason?.includes('Invalid appointment duration'));
 }
});
