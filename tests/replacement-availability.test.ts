import test from 'node:test';
import assert from 'node:assert/strict';
import {replacementAvailability} from '../apps/web/lib/replacement-availability.ts';
const original={resourceId:'operator',start:'2026-10-16T14:00:00Z',end:'2026-10-16T20:00:00Z'};
const neighbor={resourceId:'operator',start:'2026-10-16T20:00:00Z',end:'2026-10-16T22:00:00Z'};
test('replacement preview excludes only the validated original and retains competing reservations',()=>{
 const other={...original,resourceId:'other-operator'};
 assert.deepEqual(replacementAvailability([original,neighbor,other],[{...original,start:'2026-10-16T09:00:00-05:00',end:'2026-10-16T15:00:00-05:00'}]),[neighbor,other]);
 assert.deepEqual(replacementAvailability([original,neighbor],[]),[original,neighbor]);
});
test('changed original bounds cannot free a different or extended reservation',()=>{
 assert.deepEqual(replacementAvailability([original,neighbor],[{...original,end:'2026-10-16T18:00:00Z'}]),[original,neighbor]);
});
