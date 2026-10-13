import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarExportRun} from '../apps/web/lib/calendar-export-run.ts';
test('paused and disconnected optional exports do not attempt OAuth, sync or delete queued work',async()=>{
 const calls:string[]=[];
 const dependencies={readConnection:async()=>{calls.push('read');return false;},sync:async()=>{calls.push('sync');return {results:[]};},checkMaps:async()=>{calls.push('maps');return 'active';}};
 assert.deepEqual(await calendarExportRun(false,dependencies),{processed:0,status:'paused'});
 assert.deepEqual(calls,[]);
 assert.deepEqual(await calendarExportRun(true,dependencies),{processed:0,status:'disconnected'});
 assert.deepEqual(calls,['read']);
});
test('connected export preserves processed results when independent Maps verification fails',async()=>{
 assert.deepEqual(await calendarExportRun(true,{readConnection:async()=>true,sync:async()=>({results:['saved','saved']}),checkMaps:async()=>{throw Error('synthetic maps failure');}}),{processed:2,status:'completed',maps:'verification_unavailable'});
});
test('real connection reads and export failures remain failures instead of false idle success',async()=>{
 let synced=false;
 const dependencies={readConnection:async()=>{throw Error('database unavailable');},sync:async()=>{synced=true;return {results:[]};},checkMaps:async()=> 'active'};
 await assert.rejects(calendarExportRun(true,dependencies),/database unavailable/);assert.equal(synced,false);
 await assert.rejects(calendarExportRun(true,{...dependencies,readConnection:async()=>true,sync:async()=>{throw Error('export failed');}}),/export failed/);
});
