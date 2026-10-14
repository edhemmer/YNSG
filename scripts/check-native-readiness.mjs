import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=JSON.parse(await readFile('contracts/native-release-evidence.json','utf8'));
assert.equal(data.version,1);assert.ok(Array.isArray(data.gates)&&data.gates.length===8);
const required=['human-security-review','native-security-audit','apple-signing','push-delivery','native-auth-and-sharing','accessibility-and-entry','apple-privacy-and-account-deletion','testflight-acceptance'];assert.deepEqual(data.gates.map(g=>g.id).sort(),required.sort(),'Required release gates cannot be removed or renamed');
const ids=new Set();for(const gate of data.gates){assert.ok(typeof gate.id==='string'&&!ids.has(gate.id));ids.add(gate.id);assert.ok(['pending','verified'].includes(gate.status));if(gate.status==='verified')assert.ok(typeof gate.evidence==='string'&&/^https:\/\//.test(gate.evidence),'Verified gates need a reviewable evidence link');}
const open=data.gates.filter(g=>g.status!=='verified');
if(open.length){console.error('NATIVE DISTRIBUTION BLOCKED: '+open.map(g=>g.id).join(', '));process.exitCode=1;}else console.log('PASS: native release evidence register complete. Apple signing/device/App Review evidence remains external proof, not a guarantee created by this script.');
