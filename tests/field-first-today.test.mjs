import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('apps/web/app/command-center.tsx','utf8');
test('Today shows actionable visits and requests before optional analytics',()=>{
 const day=s.indexOf('<OwnerDay organization=');
 const inbox=s.indexOf('<RequestInbox organization=');
 const overview=s.indexOf('<details className="owner-today-admin">');
 assert.ok(day>0&&inbox>day&&overview>inbox);
 assert.match(s,/<summary>Business overview and reports<\/summary>/);
 assert.ok(s.indexOf('className="metric-grid"')>overview);
 assert.ok(s.indexOf('<BusinessBrief')>overview);
});
test('field actions retain job opening, routes and business navigation',()=>{
 assert.match(s,/onOpen=\{onOpen\}/);
 assert.match(s,/onNavigate\('Today'\)/);
 assert.match(s,/onNavigate\(m.section\)/);
});
