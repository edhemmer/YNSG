import {execFileSync} from 'node:child_process';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const operatorOnly=new Set(['scripts/capture-recovery.mjs','scripts/recovery-bundle.mjs','scripts/recovery-file-catalog.sql','scripts/verify-recovery-catalog.mjs','scripts/verify-customer-file-restore.mjs','scripts/verify-postgres.mjs','contracts/production-completion.json','contracts/migration-history-map.json','README.md','AGENTS.md']);
export function nonRuntimePath(path){return typeof path==='string'&&!path.startsWith('/')&&!path.split('/').some(p=>p==='..'||p==='')&&(path.startsWith('docs/')||path.startsWith('tests/')||operatorOnly.has(path));}
// Exit 0 means ignore in Vercel. Any uncertainty must instead continue building.
// Compare to the last successful deployment, never just the immediate parent.
export function shouldIgnoreBuild({env=process.env,cwd=process.cwd(),git=(args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','ignore']})}={}){
 try{
  const previous=env.VERCEL_GIT_PREVIOUS_SHA,current=env.VERCEL_GIT_COMMIT_SHA;
  if(env.YNSG_FORCE_BUILD==='1'||!['production','preview'].includes(env.VERCEL_ENV)||!/^[a-f0-9]{40}$/.test(previous||'')||!/^[a-f0-9]{40}$/.test(current||'')||previous===current)return false;
  if(git(['rev-parse','HEAD']).trim()!==current)return false;
  git(['merge-base','--is-ancestor',previous,current]);
  const raw=git(['diff','--name-only','--no-renames','-z',previous,current,'--']);
  if(!raw||!raw.endsWith('\0'))return false;
  const paths=raw.slice(0,-1).split('\0');
  if(!paths.length||!paths.every(nonRuntimePath))return false;
  // A formerly operator-only module can become a runtime dependency later.
  // Any reference (including a conservative comment match) forces a build.
  const patterns=[...new Set(paths.flatMap(path=>[path,basename(path)]))].flatMap(value=>['-e',value]);
  try{if(git(['grep','-I','-F','-l',...patterns,'--','apps/web/app','apps/web/lib','api','lib','packages','site','scripts/build.mjs','scripts/seo.mjs']).trim())return false;}
  catch(error){if(error.status!==1)return false;}
  return true;
 }catch{return false;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const ignore=shouldIgnoreBuild();console.log(ignore?'Ignored: only verified non-runtime paths changed since the last successful deployment.':'Building: runtime changes, explicit rebuild, or uncertain deployment baseline.');process.exitCode=ignore?0:1;}
