import test from 'node:test';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
test('WEB-01 inventory source references and 28 gate register stay traceable',()=>{
 const output=execFileSync(process.execPath,['scripts/check-production-inventory.mjs'],{encoding:'utf8'});
 assert.match(output,/PASS source inventory/);
});
