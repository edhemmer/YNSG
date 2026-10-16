import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('new franchise tenant settings never inherit founding operator email routing',()=>{
 const code=readFileSync('apps/web/app/company-settings.tsx','utf8');
 const original='a933d657-14d3-46b6-85e6-21d973e4ed97';
 for(const field of ['sender','notificationRecipient']){
  const expected=field+': organization === "'+original+'" ? "edhemmer@gmail.com" : ""';
  assert.ok(code.includes(expected),field+' must be empty for new tenants until explicitly configured');
 }
 assert.match(code,/intakeEnabled: false/);
});
