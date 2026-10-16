import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {validateMigrationHistoryMap} from '../scripts/check-migration-history.mjs';
const map=JSON.parse(readFileSync('contracts/migration-history-map.json','utf8'));
const files=readdirSync('supabase/migrations');
test('all GitHub migrations map to observed Supabase history without claiming SQL equivalence',()=>{
 const result=validateMigrationHistoryMap(map,files);
 assert.equal(result.mapped,64);
 assert.equal(result.supabaseOnly,7);
});
test('unmapped future migration must update the observed migration register',()=>{
 assert.throws(()=>validateMigrationHistoryMap(map,[...files,'20261017000000_new_unmapped_change.sql']),/diverged/);
});
test('history duplicate and renumbering cannot silently pass',()=>{
 const altered=structuredClone(map);
 altered.repositoryMigrations[1].historyVersion=altered.repositoryMigrations[0].historyVersion;
 assert.throws(()=>validateMigrationHistoryMap(altered,files),/Duplicate Supabase history version/);
});
