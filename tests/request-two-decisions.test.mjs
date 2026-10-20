import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('apps/web/app/request-quick-actions.tsx','utf8');
test('unconfirmed actionable requests offer Confirm and Decline, not a third competing action',()=>{
 assert.match(s,/const decisionRequired=manageable&&\(Boolean\(proposal\)\|\|!confirmed\)/);
 assert.match(s,/\{decisionRequired&&<>/);
 assert.match(s,/Confirm appointment/);
 assert.match(s,/Decline request/);
 assert.match(s,/\{!decisionRequired&&<button[^>]+onClick=\{onReview\}/);
});
test('owner can access full original notes and schedule by opening confirmation panel',()=>{
 assert.match(s,/RequestDetail organization=\{organization\} requestId=\{request\.id\}/);
 assert.match(s,/initialPanel="schedule"/);
});
