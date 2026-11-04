import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/api/workspace/route.ts',import.meta.url),'utf8');
// Each list page must show the newest records first; ordering by id alone buries them on later pages.
const listing=(table)=>{
 const start=source.indexOf(`.from("${table}")`);
 assert.ok(start>=0,`${table} listing present`);
 return source.slice(start,source.indexOf('.range(from,to)',start));
};
for(const [table,column] of [['quotes','created_at'],['jobs','created_at'],['invoices','issued_at']]){
 test(`${table} are paged newest first with id as a stable tie-breaker`,()=>{
  assert.match(listing(table),new RegExp(`\\.order\\("${column}", \\{ ascending: false \\}\\)\\.order\\("id"\\)`));
 });
}
