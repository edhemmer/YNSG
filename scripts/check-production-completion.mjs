import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const expected={web:Array.from({length:17},(_,i)=>`WEB-${String(i+1).padStart(2,'0')}`),ios:Array.from({length:8},(_,i)=>`IOS-${String(i+1).padStart(2,'0')}`),scale:Array.from({length:3},(_,i)=>`SCALE-${String(i+1).padStart(2,'0')}`)};
export function validateCompletion(data){
 assert.equal(data.version,1);assert.match(data.updatedAt,/^\d{4}-\d{2}-\d{2}$/);assert.match(data.baselineCommit,/^[a-f0-9]{40}$/);assert.deepEqual(data.milestones,['web','ios','scale']);
 assert.ok(Array.isArray(data.gates));assert.deepEqual(data.gates.map(g=>g.id).sort(),Object.values(expected).flat().sort(),'Required completion gates cannot be removed, duplicated or renamed');
 const gates=new Map(data.gates.map(g=>[g.id,g])),requirements=new Set();
 for(const g of data.gates){
  assert.ok(expected[g.milestone]?.includes(g.id),'Gate milestone cannot change');
  for(const f of ['title','owner','nextAction','acceptance','requiredEvidence'])assert.ok(typeof g[f]==='string'&&g[f].trim().length>2,`${g.id}: missing ${f}`);
  assert.ok(['open','working','blocked','verified'].includes(g.status));assert.ok(Array.isArray(g.requirements)&&g.requirements.length>0);
  for(const r of g.requirements){assert.match(r,/^R(0[1-9]|1[0-9]|2[01])$/);requirements.add(r);}
  assert.ok(Array.isArray(g.dependsOn)&&new Set(g.dependsOn).size===g.dependsOn.length);
  for(const d of g.dependsOn)assert.ok(gates.has(d)&&d!==g.id,'Unknown or self dependency');
  assert.ok(Array.isArray(g.evidence));if(g.status==='blocked')assert.ok(typeof g.blocker==='string'&&g.blocker.trim().length>3,'Blocked gate needs precise blocker');
  for(const e of g.evidence){assert.match(e.candidate,/^[a-f0-9]{40}$/);assert.equal(e.result,'pass');assert.ok(typeof e.reviewer==='string'&&e.reviewer.trim().length>2);assert.ok(typeof e.checkedAt==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(e.checkedAt)&&Number.isFinite(Date.parse(e.checkedAt))&&Date.parse(e.checkedAt)<=Date.now(),'Evidence requires a real, nonfuture timestamp');const url=new URL(e.url);assert.equal(url.protocol,'https:');assert.ok(!url.username&&!url.password&&!url.searchParams.has('token'),'No credentials in evidence URLs');}
  if(g.status==='verified'){assert.ok(!g.blocker,'Verified gate cannot retain blocker');assert.ok(g.evidence.length>0,`${g.id}: verification needs evidence`);for(const d of g.dependsOn)assert.equal(gates.get(d).status,'verified',`${g.id}: unverified dependency ${d}`);}
 }
 assert.equal(requirements.size,21,'R01–R21 must remain covered');
 const visit=(id,path=new Set())=>{assert.ok(!path.has(id),'Cyclic gate dependencies');const next=new Set(path);next.add(id);for(const d of gates.get(id).dependsOn)visit(d,next);};for(const id of gates.keys())visit(id);
 return data;
}
export function releaseFailures(data,milestone,candidate,native){
 validateCompletion(data);assert.ok(expected[milestone],'Unknown milestone');assert.match(candidate,/^[a-f0-9]{40}$/,'A full accepted candidate SHA is required');
 const scope=milestone==='web'?['web']:['web',milestone];const failures=data.gates.filter(g=>scope.includes(g.milestone)&&(g.status!=='verified'||!g.evidence.some(e=>e.candidate===candidate))).map(g=>g.id);
 if(milestone==='ios'){assert.ok(native&&Array.isArray(native.gates)&&native.gates.length===8,'Native evidence register required');for(const g of native.gates)if(g.status!=='verified'||!/^https:\/\//.test(g.evidence||''))failures.push('native:'+g.id);}
 return failures;
}
export function completionReport(data){
 validateCompletion(data);
 return {updatedAt:data.updatedAt,milestones:data.milestones.map(milestone=>{
  const gates=data.gates.filter(g=>g.milestone===milestone);
  return {milestone,accepted:gates.filter(g=>g.status==='verified').length,total:gates.length,
   gates:gates.map(g=>({id:g.id,title:g.title,status:g.status,owner:g.owner,
    unverifiedDependencies:g.dependsOn.filter(id=>data.gates.find(d=>d.id===id).status!=='verified'),
    blocker:g.blocker||null,nextAction:g.nextAction,requiredEvidence:g.requiredEvidence}))};
 })};
}
function main(){const args=process.argv.slice(2);const value=flag=>args[args.indexOf(flag)+1];const data=validateCompletion(JSON.parse(readFileSync('contracts/production-completion.json','utf8')));
 if(args.includes('--release')){const milestone=value('--release'),candidate=args.includes('--candidate')?value('--candidate'):'';const native=milestone==='ios'?JSON.parse(readFileSync('contracts/native-release-evidence.json','utf8')):null;const failed=releaseFailures(data,milestone,candidate,native);if(failed.length){console.error('PRODUCTION COMPLETION BLOCKED: '+failed.join(', '));process.exitCode=1;}else console.log('REGISTER PASS: '+milestone+' candidate '+candidate+'. Evidence authenticity, human acceptance and actual provider/Apple decisions require separate review.');}
 else if(args.includes('--report')){
  const report=completionReport(data);
  if(args.includes('--json'))console.log(JSON.stringify(report,null,2));
  else for(const milestone of report.milestones){
   console.log(`${milestone.milestone}: ${milestone.accepted}/${milestone.total} gates accepted`);
   for(const g of milestone.gates){console.log(`${g.id} [${g.status}] ${g.title}`);if(g.status==='verified')continue;
    if(g.unverifiedDependencies.length)console.log('  Requires: '+g.unverifiedDependencies.join(', '));
    if(g.blocker)console.log('  Blocker: '+g.blocker);
    console.log(`  Next [${g.owner}]: ${g.nextAction}`);
    console.log('  Evidence: '+g.requiredEvidence);
   }
  }
 }
 else console.log('PASS: completion register integrity; open gates are not product readiness.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(e){console.error('Completion check failed: '+e.message);process.exitCode=1;}}
