import test from 'node:test';
import assert from 'node:assert/strict';
import {needsRoutesProbe} from '../apps/web/lib/routes-health.ts';
import {googleRouteProvider} from '../apps/web/lib/google-routes.ts';
const now=Date.parse('2026-10-09T17:00:00Z'),fingerprint='a'.repeat(64);
test('route connection checks reuse recent verification, immediately check changed keys, and back off after errors',()=>{
 const saved={key_fingerprint:fingerprint,status:'active' as const,checked_at:new Date(now-10000).toISOString()};
 assert.equal(needsRoutesProbe(saved,fingerprint,now),false);assert.equal(needsRoutesProbe(saved,'b'.repeat(64),now),true);
 assert.equal(needsRoutesProbe({...saved,status:'error'},fingerprint,now),false);
 assert.equal(needsRoutesProbe({...saved,status:'error',checked_at:new Date(now-3600000).toISOString()},fingerprint,now),true);
 assert.equal(needsRoutesProbe({...saved,checked_at:new Date(now-86400000).toISOString()},fingerprint,now),true);
 assert.equal(needsRoutesProbe(null,fingerprint,now),true);
});
test('exhausted or unavailable quota blocks Google calls before addresses are transmitted',async()=>{
 let sent=0;const send=async()=>{sent++;return Response.json({routes:[{duration:'600s',distanceMeters:1000}]});};
 await assert.rejects(googleRouteProvider('synthetic',send,async()=>false)!('A','B','2026-10-09T17:05Z'),/ROUTE_BUDGET_LIMIT/);
 await assert.rejects(googleRouteProvider('synthetic',send,async()=>{throw Error('ROUTE_BUDGET_UNAVAILABLE')})!('A','B','2026-10-09T17:05Z'));
 assert.equal(sent,0);
});
