import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePolyline} from '../apps/web/lib/google-map-browser.ts';
import {marketingCalendarEvent,saveMarketingEvent} from '../apps/web/lib/marketing-calendar.ts';
import {dayPlanFingerprint,type DayCall} from '../apps/web/lib/day-plan.ts';
test('route geometry decodes the Google reference example and rejects broken coordinates',()=>{
 assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'),[{lat:38.5,lng:-120.2},{lat:40.7,lng:-120.95},{lat:43.252,lng:-126.453}]);
 for(const input of ['~','!','~~~~~~~~~~~'])assert.throws(()=>decodePolyline(input));
});
const input={organization:'synthetic-org',key:'synthetic-key',title:'Furniture assembly',draft:'Review this published service draft.',date:'2026-10-15',timezone:'America/Chicago'};
test('marketing reminders save the actual draft, are private and do not block appointments or invite customers',()=>{
 const a=marketingCalendarEvent(input),b=marketingCalendarEvent(input);
 assert.equal(a.id,b.id);assert.equal(a.description,input.draft);assert.equal(a.transparency,'transparent');assert.equal(a.visibility,'private');assert.equal(a.start.timeZone,'America/Chicago');assert.equal('attendees' in a,false);
 assert.notEqual(a.id,marketingCalendarEvent({...input,organization:'other-org'}).id);
});
test('lost marketing response recovers the same Google event; changed retry cannot claim old draft saved',async()=>{
 const event=marketingCalendarEvent(input);let writes=0;
 const send=async(_url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='POST'){writes++;return Response.json(event);}return writes?Response.json(event):new Response('',{status:404});};
 const first=await saveMarketingEvent('synthetic','calendar',input,send);
 assert.deepEqual(await saveMarketingEvent('synthetic','calendar',input,send),first);assert.equal(writes,1);
 await assert.rejects(saveMarketingEvent('synthetic','calendar',{...input,draft:'Changed draft text'},send),/MARKETING_RETRY_CHANGED/);
});
test('day metadata changes when a visit moves or its address changes',()=>{
 const call={id:'a',revision:1,startAt:'a',endAt:'b',arrivalAt:'a',status:'reserved',customerResponse:'pending',address:'100 Test St',name:'Test',tasks:['Assembly']} as DayCall;
 assert.notEqual(dayPlanFingerprint([call]),dayPlanFingerprint([{...call,address:'200 Test St'}]));
 assert.notEqual(dayPlanFingerprint([call]),dayPlanFingerprint([{...call,revision:2}]));
});
