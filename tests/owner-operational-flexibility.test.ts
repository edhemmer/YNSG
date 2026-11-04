import test from 'node:test';import assert from 'node:assert/strict';
import {ownerOpenTimes} from '../packages/domain/owner-availability.ts';
import {ownerVisitStart,ownerVisitDates} from '../apps/web/lib/visit-start.ts';
import {crewTerms,crewBilledMinutes} from '../apps/web/lib/crew-billing.ts';
import {recordOwnerWork,ownerRequestInput} from '../apps/web/lib/owner-work-contract.ts';
import {schedulingFailure} from '../apps/web/lib/scheduling-errors.ts';
test('a rejected past owner time remains editable instead of locking as an unknown booking',()=>{
 const result=schedulingFailure('INVALID_OWNER_VISIT_TIME');assert.equal(result.status,409);assert.match(result.error,/Record completed work/);
 assert.equal(schedulingFailure('unrecognized database failure').status,503);
});
test('owner capacity permits same-day after-hours short visits but keeps real conflicts',()=>{
 const clock=Date.parse('2026-11-03T23:00:00Z'),resource='operator';
 const input={clock,timezone:'America/Chicago',durationMinutes:60,windowEnd:clock+3600000,rules:{weekdays:[1],earliestStart:480,latestStart:900,endOfDay:1020,leadMinutes:1440,horizonMinutes:43200,bufferMinutes:0,selectionMinutes:10,proposalMinutes:120,pendingLimit:1},resources:[{id:resource,kind:'operator',status:'available'}],selectedResources:[resource],reservations:[],blocks:[],externalBusy:[],externalBusyVerifiedUntil:clock+60000};
 assert.equal(ownerOpenTimes(input)[0]?.start,clock);
 assert.equal(ownerOpenTimes({...input,blocks:[{start:clock,end:clock+7200000}]}).length,0);
 assert.throws(()=>ownerOpenTimes({...input,durationMinutes:0}));
 assert.throws(()=>ownerOpenTimes({...input,selectedResources:['other']}));
});
test('owner date entry permits any valid minute and includes today',()=>{
 assert.equal(ownerVisitStart('2026-11-03','19:17'),'2026-11-03T19:17');
 assert.throws(()=>ownerVisitStart('2026-02-30','19:17'));
 assert.equal(ownerVisitDates('America/Chicago',Date.parse('2026-11-03T23:00Z'))[0],'2026-11-03');
});
test('actual-minute owner pricing preserves historical accepted minimums',()=>{
 const terms={plannedPeople:1,perPersonRateCents:6000,additionalPersonMinimumMinutes:0,partialExtension:'exact' as const};
 const actual=crewTerms.parse({...terms,billingBasis:'per_person_actual',firstPersonMinimumMinutes:0});
 const retained=crewTerms.parse({...terms,billingBasis:'per_person_first_minimum',firstPersonMinimumMinutes:120});
 assert.equal(crewBilledMinutes(60,1,actual),60);assert.equal(crewBilledMinutes(60,1,retained),120);
});
test('walk-up input has no marketing territory or mandatory email rule; real agreement remains explicit',()=>{
 assert.equal(ownerRequestInput.parse({name:'Synthetic owner entry',phone:'',email:'',street:'100 Test St',city:'Naperville',state:'IL',postalCode:'',serviceId:'20000000-0000-4000-8000-000000000001',description:'Actual leaf management'}).city,'Naperville');
 const value={organizationId:'20000000-0000-4000-8000-000000000001',command:'RecordOwnerWork',key:'synthetic-owner-key',id:'20000000-0000-4000-8000-000000000002',revision:1,startAt:'2026-11-03T12:00:00Z',endAt:'2026-11-03T13:00:00Z',description:'Actual leaf management',totalCents:null,agreement:null};
 assert.equal(recordOwnerWork.parse(value).agreement,null);
 assert.equal(recordOwnerWork.safeParse({...value,agreement:'Agreed in person today'}).success,false);
});
