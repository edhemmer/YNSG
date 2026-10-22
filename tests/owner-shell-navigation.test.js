import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('owner mobile shell has one persistent entry to secondary navigation',()=>{
  assert.match(source,/className="crm-mobile-dock"/);
  assert.match(source,/aria-label="More workspace tools"/);
  assert.doesNotMatch(source,/aria-label="Toggle workspace menu"/);
  assert.match(source,/setMobileNav\(v=>!v\)/);
});
test('mobile dock keeps Today, Requests and Jobs as primary actions',()=>{
  assert.match(source,/\['Dashboard','Requests','Work'\]\.includes\(s\.key\)/);
  assert.match(source,/\{key:'Dashboard',label:'Today'/);
  assert.match(source,/\{key:'Requests',label:'Requests'/);
  assert.match(source,/\{key:'Calendar',label:'Calendar'/);
  assert.match(source,/onClick=\{\(\)=>navigate\(s\.key\)\}/);
  assert.doesNotMatch(source,/className="topbar-actions"[^\n]*\{operational&&<button/);
});
test('owner can still sign out deliberately and navigate to notifications',()=>{
  assert.match(source,/aria-label="Sign out"/);
  assert.match(source,/window\.confirm\('Sign out of your workspace\?'\)/);
  assert.match(source,/aria-label="Activity and messages"/);
});
