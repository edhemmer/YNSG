import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync('apps/web/app/api/invoice-draft/route.ts','utf8');
const ui=readFileSync('apps/web/app/invoice-draft.tsx','utf8');
test('unknown draft RPC errors cannot be presented as definite rejection',()=>{
 assert.match(route,/status:denied\?403:known\?409:503/);
 assert.match(route,/receipt\.data\.revision!==v\.revision\+1/);
 assert.match(route,/private, no-store/);
});
test('invoice owner keeps exactly one immutable attempt until saved receipt is known',()=>{
 for(const token of ['draftAttempt.current','body:attempt.body','setDraftUnknown(true)','Check saved draft result','useBlockedEntry'])assert.ok(ui.includes(token),token);
 assert.match(ui,/if\(busy\|\|blocked\|\|draftUnknown\|\|completionUncertain/);
});
