import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const center=readFileSync(new URL('../apps/web/app/command-center.tsx',import.meta.url),'utf8');
const rules=readFileSync(new URL('../docs/governance.md',import.meta.url),'utf8');
test('Today prioritizes the next task, direct Jobs and optional unfinished jobs',()=>{
 assert.match(center,/Ready for your next stop/);
 assert.match(center,/onNavigate\('Work'\)/);
 assert.match(center,/<summary>Continue unfinished jobs<\/summary><OwnerWork/);
 assert.match(center,/<OwnerDay organization=\{organization\} revision=\{revision\} onNavigate=\{onNavigate\} onOpen=\{onOpen\}/);
});
test('field OS rules require evidence and prevent unapproved AI-side effects',()=>{
 assert.match(rules,/AI-assisted field operating system/);
 assert.match(rules,/Auto-preparation is \*\*not\*\* permission/);
 assert.match(rules,/Unconfigured AI providers must degrade/);
});
