import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('owner learning displays when and where, numbered procedure, warnings and attributed tips',()=>{
 const code=readFileSync('apps/web/app/owner-learning-toolkit.tsx','utf8');
 for(const text of ['Where this applies','When to use it','Step-by-step field checklist','Watch out — stop and reassess','Pro tip','Manufacturer troubleshooting principle','Training reference, not a certified procedure'])assert.ok(code.includes(text));
 assert.match(code,/lesson\.steps\.map\(\(s,i\)=>/);
 assert.match(code,/selected\.url/);
});
test('education content is not silently published as verified based on an AI proposal',()=>{
 const contract=readFileSync('packages/contracts/education.ts','utf8');
 assert.match(contract,/publication:'draft' as const/);
 assert.match(contract,/Human technical review required before publication/);
 assert.match(contract,/whereToUse/);
 assert.match(contract,/whenToUse/);
});
