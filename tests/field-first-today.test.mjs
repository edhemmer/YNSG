import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('apps/web/app/command-center.tsx','utf8');
test('Today contains one operational queue without marketing, metrics or stacked assistants',()=>{
 assert.match(s,/aria-label="Field work queue"/);assert.doesNotMatch(s,/MarketingDrafts|BusinessBrief|metric-grid|Business overview/);
 assert.match(s,/const activeWork=shownWork\.find/);assert.match(s,/used\.has\(c.requestId\)/);
});
test('field queue retains direct job opening, routes and invoices',()=>{
 assert.match(s,/onOpen\(next.request\)/);assert.match(s,/onNavigate\('Today'\)/);assert.match(s,/onNavigate\('Money'\)/);
});

test('Today offers direct navigation and does not imply that opening a paused job resumes a timer',()=>{
 assert.match(s,/navigationUrl\(next\.address\)/);
 assert.match(s,/Review paused job/);
 assert.match(s,/aria-label=\{'Directions to '\+next\.name\}/);
});

test('Today puts field visits ahead of invoice-only work without hiding invoice backlog',()=>{
 assert.match(s,/const next=activeWork\|\|\(!stops\.length\?shownWork\[0\]:null\)/);
 assert.match(s,/const remainingWork=shownWork\.filter/);
 assert.match(s,/remainingWork\.map\(j=>/);
 assert.match(s,/remainingWork\.length>0/);
});

test('Today presents owner decisions as an explicit queue and never mistakes loaded subset for an empty business',()=>{
 assert.match(s,/Requests needing a decision/);
 assert.match(s,/pending\.length/);
 assert.match(s,/data\.requests\?\.hasMore/);
 assert.match(s,/No outstanding decisions in the loaded queue/);
});

test('Today displays new customer decisions before secondary work backlog',()=>{
 const decisions=s.indexOf('aria-label="Requests awaiting a decision"');
 const later=s.indexOf('aria-label="Remaining work"');
 assert.ok(decisions>0&&later>decisions,'Owner review must be visible above expanded backlog');
});

test('Today keeps field actions available during periodic background updates',()=>{
 assert.match(s,/let live=true,inFlight=false,firstRead=true/);
 assert.match(s,/if\(firstRead\)setRefreshing\(true\)/);
 assert.match(s,/setRefreshing\(false\);firstRead=false/);
 assert.match(s,/aria-busy=\{refreshing\}/);
});

test('Today never hides an explicit review decision merely because a job or reserved visit is linked',()=>{
 assert.match(s,/const pending=\(data\?\.requests\?\.requests\|\|\[\]\)\.filter\(r=>!\['declined','canceled'\]\.includes\(r\.status\)\)/);
 assert.doesNotMatch(s,/!used\.has\(r\.id\)/);
 assert.doesNotMatch(s,/!r\.appointments\.some\(a=>a\.status==='reserved'\)/);
});
