import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
export const certificationChecks=Object.freeze([
 ['release','web','npm',['run','verify:release']],
 ['public-build','web','node',['scripts/build.mjs']],
 ['crm-build','web','pnpm',['--dir','apps/web','exec','next','build']],
 ['native-types','native','pnpm',['--dir','apps/mobile','typecheck']],
 ['native-lint','native','pnpm',['--dir','apps/mobile','lint']],
 ['native-sdk','native','pnpm',['--dir','apps/mobile','exec','expo','install','--check']],
 ['native-ios-bundle','native','pnpm',['--dir','apps/mobile','bundle:ios']],
 ['native-audit','native','pnpm',['--dir','apps/mobile','audit','--prod','--audit-level','high']],
 ['native-evidence','gate','node',['scripts/check-native-readiness.mjs']],
 ...['web','ios','scale'].map(m=>[m+'-gate','gate','npm',['run','completion:gate','--','--release',m,'--candidate','$CANDIDATE_COMMIT']]),
].map(([id,scope,command,args])=>Object.freeze({id,scope,command,args:Object.freeze(args)})));
async function execute(command,args){
 return new Promise(resolveResult=>{
  const child=spawn(command,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',TURBO_TELEMETRY_DISABLED:'1',EXPO_OFFLINE:'1'}});
  let tail='';const append=data=>{tail=(tail+data.toString()).slice(-8000);};child.stdout.on('data',append);child.stderr.on('data',append);
  child.on('error',error=>resolveResult({exitCode:127,tail:'Could not start the required check: '+error.code}));
  child.on('close',(code,signal)=>resolveResult({exitCode:code??1,tail,signal:signal||undefined}));
 });
}
const evidenceRegisters=new Set(['contracts/production-completion.json','contracts/native-release-evidence.json']);
export async function verifyCandidateEvidence(candidate,evidenceCommit,run=execute){
 if(!/^[a-f0-9]{40}$/.test(candidate)||!/^[a-f0-9]{40}$/.test(evidenceCommit))throw Error('Candidate and evidence must be immutable full commit SHAs.');
 const ancestor=await run('git',['merge-base','--is-ancestor',candidate,evidenceCommit]);
 if(ancestor.exitCode!==0)throw Error('The tested candidate must be an ancestor of the evidence commit.');
 const diff=await run('git',['diff','--name-only','--no-renames','-z',candidate,evidenceCommit,'--']);
 if(diff.exitCode!==0||(diff.tail&&!diff.tail.endsWith('\0')))throw Error('Cannot verify the complete candidate/evidence difference.');
 const changedPaths=diff.tail.split('\0').filter(Boolean);
 if(changedPaths.some(path=>!evidenceRegisters.has(path)))throw Error('Application source changed after the tested candidate. Revalidate a new candidate.');
 const tree=await run('git',['rev-parse',candidate+'^{tree}']);
 if(tree.exitCode!==0||!/^[a-f0-9]{40}$/.test(tree.tail.trim()))throw Error('Cannot verify the immutable candidate tree.');
 return {candidate,evidenceCommit,candidateTree:tree.tail.trim(),ancestor:true,changedPaths};
}
export async function certifySource(source,run=execute,onResult=()=>{}){
 source={...source};delete source.candidateProof;
 if(!/^[a-f0-9]{40}$/.test(source.commit)||!/^[a-f0-9]{40}$/.test(source.tree)||!source.clean)throw Error('Certification requires an exact clean committed source tree.');
 const candidate=source.candidateCommit??source.commit;
 if(!/^[a-f0-9]{40}$/.test(candidate))throw Error('Certification requires an immutable full candidate SHA.');
 if(candidate!==source.commit){
  // Always derive the proof from git here, never trust caller-supplied metadata.
  source={...source,candidateCommit:candidate,candidateProof:await verifyCandidateEvidence(candidate,source.commit,run)};
 }
 const startedAt=new Date().toISOString(),checks=[];
 for(const check of certificationChecks){
  const args=check.args.map(arg=>arg==='$CANDIDATE_COMMIT'?candidate:arg),started=Date.now();
  let outcome;try{outcome=await run(check.command,args);}catch{outcome={exitCode:1,tail:'Check runner failed; result remains unverified.'};}
  const result={id:check.id,scope:check.scope,command:[check.command,...args],passed:outcome.exitCode===0,exitCode:outcome.exitCode,durationMs:Date.now()-started,output:outcome.tail};
  checks.push(result);onResult(result);
 }
 const verified=scope=>checks.filter(c=>c.scope===scope).every(c=>c.passed);
 const machineChecksPassed=checks.every(c=>c.passed);
 return {version:1,source,startedAt,finishedAt:new Date().toISOString(),scope:'Local machine checks and registered evidence gates; excludes remote CI/deployment identity and independent authentication of owner, device, provider, legal and human-review evidence.',webBuildVerified:verified('web'),nativeBuildVerified:verified('native'),registeredEvidenceChecksPassed:verified('gate'),machineChecksPassed,decision:machineChecksPassed?'ready_for_evidence_review':'blocked',checks};
}
async function main(){
 const {values}=parseArgs({options:{candidate:{type:'string'},output:{type:'string',default:'/tmp/ynsg-production-certification-'+Date.now()+'.json'}},allowPositionals:false,strict:true});
 const git=async args=>{const r=await execute('git',args);if(r.exitCode!==0)throw Error('Cannot identify committed source.');return r.tail.trim();};
 const source={commit:await git(['rev-parse','HEAD']),tree:await git(['rev-parse','HEAD^{tree}']),clean:(await git(['status','--porcelain'])).length===0,...(values.candidate!==undefined?{candidateCommit:values.candidate}:{})};
 const report=await certifySource(source,execute,result=>console.log((result.passed?'PASS':'FAIL')+': '+result.id));
 const after={commit:await git(['rev-parse','HEAD']),tree:await git(['rev-parse','HEAD^{tree}']),clean:(await git(['status','--porcelain'])).length===0};
 report.sourceUnchanged=after.clean&&after.commit===source.commit&&after.tree===source.tree;if(!report.sourceUnchanged){report.machineChecksPassed=false;report.decision='blocked';}
 await writeFile(resolve(values.output),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('Verification decision: '+report.decision+'. Report: '+resolve(values.output));
 if(!report.machineChecksPassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
