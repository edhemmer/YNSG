import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCompletion,releaseFailures} from '../scripts/check-production-completion.mjs';
const load=()=>JSON.parse(readFileSync('contracts/production-completion.json','utf8'));
const candidate='a'.repeat(40);
const evidence=()=>({candidate,checkedAt:'2026-10-15T12:00:00Z',reviewer:'Synthetic reviewer',url:'https://example.org/synthetic-evidence',result:'pass'});
function openRegister(){const d=load();for(const g of d.gates){g.status='open';g.evidence=[];delete g.blocker;}return d;}
function verified(){const d=load();for(const g of d.gates){g.status='verified';delete g.blocker;g.evidence=[evidence()];}return d;}
test('completion register retains all release milestones and original requirement coverage',()=>{assert.equal(validateCompletion(load()).gates.length,28);for(const mutate of [d=>d.gates.pop(),d=>d.gates[0].milestone='ios',d=>d.gates.forEach(g=>g.requirements=g.requirements.filter(r=>r!=='R21'))]){const d=load();mutate(d);assert.throws(()=>validateCompletion(d));}});
test('completion evidence cannot hide unverified dependencies, cycles, missing proof or blockers',()=>{for(const mutate of [d=>{d.gates[1].status='verified';d.gates[1].evidence=[evidence()];},d=>d.gates[0].dependsOn=['WEB-17'],d=>{d.gates[0].status='verified';},d=>{d.gates[0].status='blocked';},d=>{d.gates[0].evidence=[{...evidence(),url:'https://user:secret@example.org'}];}]){const d=openRegister();mutate(d);assert.throws(()=>validateCompletion(d));}});
test('release acceptance fails closed on open gates and mismatched candidate evidence',()=>{assert.equal(releaseFailures(openRegister(),'web',candidate).length,17);const d=verified();assert.equal(releaseFailures(d,'web',candidate).length,0);assert.equal(releaseFailures(d,'web','b'.repeat(40)).length,17);assert.throws(()=>releaseFailures(d,'web','short'));assert.throws(()=>releaseFailures(d,'unknown',candidate));});
test('native and scale acceptance cannot be substituted for daily web acceptance',()=>{const d=verified();const native=JSON.parse(readFileSync('contracts/native-release-evidence.json','utf8'));for(const g of native.gates){g.status='pending';g.evidence='';}assert.equal(releaseFailures(d,'ios',candidate,native).length,8);for(const g of native.gates){g.status='verified';g.evidence='https://example.org/synthetic-native-evidence';}assert.equal(releaseFailures(d,'ios',candidate,native).length,0);assert.equal(releaseFailures(d,'scale',candidate).length,0);d.gates.find(g=>g.id==='IOS-08').status='open';assert.equal(releaseFailures(d,'web',candidate).length,0);d.gates.find(g=>g.id==='WEB-17').status='open';assert.throws(()=>releaseFailures(d,'scale',candidate));});

test('full gate report includes all 28 gates and dependencies rather than hiding later acceptance',async()=>{
 const {completionReport}=await import('../scripts/check-production-completion.mjs');const d=openRegister();Object.assign(d.gates.find(g=>g.id==='WEB-01'),{status:'verified',evidence:[evidence()]});Object.assign(d.gates.find(g=>g.id==='IOS-02'),{status:'blocked',blocker:'Synthetic missing device evidence'});const report=completionReport(d),gates=report.milestones.flatMap(m=>m.gates);
 assert.equal(gates.length,28);assert.deepEqual(gates.map(g=>g.id),d.gates.map(g=>g.id));
 assert.ok(gates.find(g=>g.id==='WEB-17').unverifiedDependencies.includes('WEB-16'));
 assert.ok(gates.find(g=>g.id==='IOS-02').blocker);assert.ok(gates.every(g=>g.nextAction&&g.requiredEvidence));
 assert.equal(report.milestones[0].accepted,1);assert.equal(gates.find(g=>g.id==='WEB-01').status,'verified');
});

test('full gate report accepts complete evidence without relying on current register status',async()=>{
 const {completionReport}=await import('../scripts/check-production-completion.mjs');const report=completionReport(verified());
 assert.deepEqual(report.milestones.map(m=>m.accepted),[17,8,3]);assert.ok(report.milestones.flatMap(m=>m.gates).every(g=>g.status==='verified'&&g.unverifiedDependencies.length===0));
});
