import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

/** Offline guard: compare source migration identities to an independently observed
 * Supabase history snapshot. Does NOT assert SQL body equivalence or live drift. */
export function validateMigrationHistoryMap(map, files){
 assert.match(map.observedOn,/^\\d{4}-\\d{2}-\\d{2}$/);
 assert.match(map.sourceCommit,/^[a-f0-9]{40}$/);
 assert.match(map.supabaseProjectRef,/^[a-z]{20}$/);
 assert.ok(map.verificationScope.includes('Does not establish equal SQL content'));
 assert.ok(Array.isArray(map.repositoryMigrations));
 assert.ok(Array.isArray(map.supabaseOnlyHistoricalMigrations));
 const source=files.filter(f=>f.endsWith('.sql')).sort();
 const names=new Set(),versions=new Set();
 const saved=map.repositoryMigrations.map(entry=>{
  assert.match(entry.file,/^\\d{14}_[a-z0-9_]+\\.sql$/);
  assert.match(entry.historyVersion,/^\\d{14}$/);
  assert.equal(entry.name,entry.file.replace(/^\\d+_/,'').replace(/\\.sql$/,''));
  assert.ok(!names.has(entry.name),'Duplicate migration name');
  assert.ok(!versions.has(entry.historyVersion),'Duplicate Supabase history version');
  names.add(entry.name);versions.add(entry.historyVersion);return entry.file;
 }).sort();
 assert.deepEqual(saved,source,'GitHub migration filenames diverged from recorded history mapping');
 for(const entry of map.supabaseOnlyHistoricalMigrations){
  assert.match(entry.name,/^[a-z0-9_]+$/);assert.match(entry.historyVersion,/^\\d{14}$/);
  assert.ok(!names.has(entry.name),'Supplemental migration name duplicates a source migration');
  assert.ok(!versions.has(entry.historyVersion),'Supplemental version duplicates applied history');
  names.add(entry.name);versions.add(entry.historyVersion);
 }
 assert.equal(map.repositoryMigrations.length+map.supabaseOnlyHistoricalMigrations.length,versions.size);
 return {mapped:map.repositoryMigrations.length,supabaseOnly:map.supabaseOnlyHistoricalMigrations.length};
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const map=JSON.parse(readFileSync('contracts/migration-history-map.json','utf8'));
  const files=readdirSync('supabase/migrations');
  const result=validateMigrationHistoryMap(map,files);
  console.log('PASS: GitHub migration filenames match observed Supabase migration names ('+result.mapped+' source mappings; '+result.supabaseOnly+' historical Supabase-only entries). SQL-content and current live parity are not asserted.');
 }catch(error){console.error('Migration history mapping check failed: '+error.message);process.exitCode=1;}
}
