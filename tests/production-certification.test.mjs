import test from 'node:test';import assert from 'node:assert/strict';
import {certifySource,certificationChecks} from '../scripts/certify-production.mjs';
const source={commit:'a'.repeat(40),tree:'b'.repeat(40),clean:true};
test('certification keeps native and evidence failures visible and continues independent checks',async()=>{const calls=[];const report=await certifySource(source,async(command,args)=>{calls.push([command,args]);return {exitCode:args.includes('audit')||args.includes('completion:gate')?1:0,tail:'Synthetic verification outcome'};});assert.equal(calls.length,certificationChecks.length);assert.equal(report.webBuildVerified,true);assert.equal(report.nativeBuildVerified,false);assert.equal(report.registeredEvidenceChecksPassed,false);assert.equal(report.decision,'blocked');assert.equal(report.machineChecksPassed,false);for(const call of calls.filter(c=>c[1].includes('--candidate')))assert.equal(call[1].at(-1),source.commit);assert.ok(report.checks.some(c=>c.id==='scale-gate'&&!c.passed));});
test('dirty, unknown or non-commit source cannot obtain a verification report',async()=>{for(const value of [{...source,clean:false},{...source,commit:'main'},{...source,tree:''}])await assert.rejects(certifySource(value,async()=>{throw Error('must not run');}),/exact clean committed/);});
test('runner errors cannot silently pass, and passing machine checks never claim independent certification',async()=>{let calls=0;const failed=await certifySource(source,async()=>{calls++;throw Error('Unavailable');});assert.equal(calls,certificationChecks.length);assert.equal(failed.decision,'blocked');assert.ok(failed.checks.every(c=>!c.passed));const passed=await certifySource(source,async()=>({exitCode:0,tail:'Synthetic'}));assert.equal(passed.decision,'ready_for_evidence_review');assert.equal(Object.hasOwn(passed,'certified'),false);assert.match(passed.scope,/excludes remote CI/);});

test('certification scope keeps every build, security and milestone check',()=>{assert.deepEqual(certificationChecks.map(c=>c.id),['release','public-build','crm-build','native-types','native-lint','native-sdk','native-ios-bundle','native-audit','native-evidence','web-gate','ios-gate','scale-gate']);assert.ok(certificationChecks.every(c=>!c.args.includes('--ignore')&&!c.args.includes('--force')));});

test('evidence recording can follow a tested candidate without requiring a self-referencing commit hash',async()=>{
 const candidate='c'.repeat(40),calls=[];
 const run=async(command,args)=>{
  calls.push([command,args]);
  if(command==='git')return {exitCode:0,tail:args[0]==='diff'?'contracts/production-completion.json\0contracts/native-release-evidence.json\0':args[0]==='rev-parse'?'d'.repeat(40):''};
  return {exitCode:0,tail:'Synthetic check'};
 };
 const report=await certifySource({...source,candidateCommit:candidate},run);
 assert.equal(report.source.candidateProof.candidate,candidate);assert.equal(report.source.candidateProof.evidenceCommit,source.commit);
 assert.deepEqual(report.source.candidateProof.changedPaths,['contracts/production-completion.json','contracts/native-release-evidence.json']);
 for(const call of calls.filter(c=>c[1].includes('--candidate')))assert.equal(call[1].at(-1),candidate);
 assert.equal(report.decision,'ready_for_evidence_review');assert.equal(Object.hasOwn(report,'certified'),false);
});
test('forged candidate proof, nonancestor history, incomplete comparison and any nonregister change are rejected before checks',async()=>{
 const candidate='c'.repeat(40);
 for(const difference of ['apps/web/app/workspace.tsx\0','scripts/check-production-completion.mjs\0','docs/production/README.md\0','contracts/production-completion.json']){
  let checks=0;const run=async(command,args)=>{if(command!=='git'){checks++;return {exitCode:0,tail:''};}return {exitCode:0,tail:args[0]==='diff'?difference:'d'.repeat(40)};};
  await assert.rejects(certifySource({...source,candidateCommit:candidate,candidateProof:{ancestor:true,changedPaths:[]}},run),/source changed|complete candidate/);assert.equal(checks,0);
 }
 await assert.rejects(certifySource({...source,candidateCommit:candidate},async()=>({exitCode:1,tail:''})),/ancestor/);
 await assert.rejects(certifySource({...source,candidateCommit:'main'},async()=>{throw Error('must not run');}),/immutable full candidate/);
});
test('actual Git ancestry permits register-only evidence and refuses changed executable source',async()=>{
 const {mkdtemp,writeFile,mkdir,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{execFileSync}=await import('node:child_process');
 const {verifyCandidateEvidence}=await import('../scripts/certify-production.mjs');const dir=await mkdtemp(join(tmpdir(),'ynsg-candidate-proof-'));
 const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Synthetic QA',GIT_AUTHOR_EMAIL:'qa@example.invalid',GIT_COMMITTER_NAME:'Synthetic QA',GIT_COMMITTER_EMAIL:'qa@example.invalid'},stdio:['ignore','pipe','ignore']});
 const run=async(command,args)=>{assert.equal(command,'git');try{return {exitCode:0,tail:git(args)};}catch{return {exitCode:1,tail:''};}};
 try{
  git(['init']);await mkdir(join(dir,'contracts'));await writeFile(join(dir,'app.js'),'export const synthetic=1;\n');await writeFile(join(dir,'contracts/production-completion.json'),'{}\n');git(['add','.']);git(['commit','-m','Synthetic candidate']);const candidate=git(['rev-parse','HEAD']).trim();
  await writeFile(join(dir,'contracts/production-completion.json'),'{"syntheticEvidence":true}\n');git(['add','.']);git(['commit','-m','Synthetic evidence']);const evidence=git(['rev-parse','HEAD']).trim();
  const proof=await verifyCandidateEvidence(candidate,evidence,run);assert.deepEqual(proof.changedPaths,['contracts/production-completion.json']);assert.equal(proof.candidateTree,git(['rev-parse',candidate+'^{tree}']).trim());
  await writeFile(join(dir,'app.js'),'export const synthetic=2;\n');git(['add','.']);git(['commit','-m','Synthetic source change']);await assert.rejects(verifyCandidateEvidence(candidate,git(['rev-parse','HEAD']).trim(),run),/source changed/);
  await assert.rejects(verifyCandidateEvidence(evidence,candidate,run),/ancestor/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
