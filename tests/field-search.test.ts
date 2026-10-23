import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldSearchMatches} from '../apps/web/lib/field-search.ts';

test('finds a customer and task across fields, ignoring accents, case and extra spaces',()=>{
 assert.equal(fieldSearchMatches('  jose   ASSEMBLY ',['José Smith','100 Oak Street','Furniture assembly']),true);
 assert.equal(fieldSearchMatches('oak smith',['José Smith','100 Oak Street']),true);
 assert.equal(fieldSearchMatches('maple smith',['José Smith','100 Oak Street']),false);
});
test('empty input matches all; query characters remain literal rather than patterns',()=>{
 assert.equal(fieldSearchMatches('   ',[]),true);
 assert.equal(fieldSearchMatches('.*',['Furniture assembly']),false);
 assert.equal(fieldSearchMatches('[',['Repair [small] chair']),true);
});
