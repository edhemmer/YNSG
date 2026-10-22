import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const center=readFileSync(new URL('../apps/web/app/command-center.tsx',import.meta.url),'utf8');
const rules=readFileSync(new URL('../docs/governance.md',import.meta.url),'utf8');
test('Today prioritizes running work and collapses later stops without a second dashboard',()=>{
 assert.match(center,/Timer running/);assert.match(center,/Other work & upcoming stops/);assert.match(center,/onOpen\(next.request\)/);assert.doesNotMatch(center,/<OwnerDay|<OwnerWork|<RequestInbox/);
});
test('field OS rules require evidence and prevent unapproved AI-side effects',()=>{
 assert.match(rules,/AI-assisted field operating system/);
 assert.match(rules,/Auto-preparation is \*\*not\*\* permission/);
 assert.match(rules,/Unconfigured AI providers must degrade/);
});
