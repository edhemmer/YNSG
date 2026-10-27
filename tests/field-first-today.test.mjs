import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('apps/web/app/command-center.tsx','utf8');
test('Today contains one operational queue without marketing, metrics or stacked assistants',()=>{
 assert.match(s,/aria-label="Field work queue"/);assert.doesNotMatch(s,/MarketingDrafts|BusinessBrief|metric-grid|Business overview/);
 assert.match(s,/const next=shownWork\[0\]/);assert.match(s,/used\.has\(c.requestId\)/);
});
test('field queue retains direct job opening, routes and invoices',()=>{
 assert.match(s,/onOpen\(next.request\)/);assert.match(s,/onNavigate\('Today'\)/);assert.match(s,/onNavigate\('Money'\)/);
});

test('Today offers direct navigation and does not imply that opening a paused job resumes a timer',()=>{
 assert.match(s,/navigationUrl\(next\.address\)/);
 assert.match(s,/Review paused job/);
 assert.match(s,/aria-label=\{'Directions to '\+next\.name\}/);
});
