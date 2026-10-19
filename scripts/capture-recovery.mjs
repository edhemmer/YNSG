import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {open,realpath,stat,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {packRecoveryBundle} from './recovery-bundle.mjs';
import {reconcileRecoveryCatalog} from './verify-recovery-catalog.mjs';
const LIMIT=32*1024**3,JSON_LIMIT=4*1024**2;
const fail=()=>{throw Error('SOURCE_CAPTURE_FAILED');};
// No shell, credentials in argv, psql startup files, or interactive password prompt.
// Command prefixes are injectable for isolated PostgreSQL CI, never CLI input.
export function snapshotDatabase({env=process.env,psql=['psql'],dump=['pg_dump'],signal}={}){
 const children=new Set();
 function launch(command,args){const child=spawn(command[0],[...command.slice(1),...args],{env,stdio:['pipe','pipe','pipe'],signal});children.add(child);child.stdin.on('error',()=>{});child.stderr.resume();const done=new Promise((ok,bad)=>{child.once('error',bad);child.once('close',code=>{children.delete(child);code===0?ok():bad(Error('DATABASE_CAPTURE_FAILED'));});});done.catch(()=>{});return {child,done};}
 return {
  async open(){
   const sql=(await readFile(new URL('./recovery-file-catalog.sql',import.meta.url),'utf8')).replace(/;\s*$/,'');
   const {child,done}=launch(psql,['-X','-q','-A','-t','-w','-v','ON_ERROR_STOP=1']);
   let output='',closed=false,finished=false;
   const ready=new Promise((ok,bad)=>{
    child.stdout.on('data',chunk=>{if(finished)return;output+=chunk.toString('utf8');if(Buffer.byteLength(output)>JSON_LIMIT){finished=true;bad(Error('CATALOG_TOO_LARGE'));child.kill();return;}const end=output.indexOf('\n');if(end>=0){try{const value=JSON.parse(output.slice(0,end));if(!/^[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+$/.test(value.snapshot))fail();finished=true;ok(value);}catch(e){finished=true;bad(e);child.kill();}}});
    done.then(()=>{if(!finished)bad(Error('SNAPSHOT_ENDED'));},bad);
   });
   child.stdin.write("begin isolation level repeatable read read only;\nset local statement_timeout=120000;\nset local idle_in_transaction_session_timeout=1200000;\nselect jsonb_build_object('snapshot',pg_export_snapshot(),'catalog',c.value::jsonb) from ("+sql+"\n) c(value);\n");
   const value=await ready;
   return {...value,alive:()=>!closed&&child.exitCode===null&&!child.killed,close:async()=>{if(closed)return;closed=true;child.stdin.end('rollback;\n');await done;}};
  },
  async dump(snapshot,path){
   const {child,done}=launch(dump,['--format=custom','--no-password','--lock-wait-timeout=30000','--snapshot='+snapshot]);child.stdin.end();
   const out=await open(path,'wx',0o600);let size=0;
   try{for await(const chunk of child.stdout){size+=chunk.length;if(size>LIMIT){child.kill();fail();}await out.writeFile(chunk);}await done;await out.sync();}finally{await out.close();}
  },
  stop(){for(const child of children)child.kill();}
 };
}
export function sourceConfiguration(env){
 const ref=env.YNSG_BACKUP_PROJECT_REF;
 if(typeof ref!=='string'||!/^[a-z]{20}$/.test(ref)||env.PGHOST!=='db.'+ref+'.supabase.co'||env.PGDATABASE!=='postgres'||env.PGUSER!=='postgres'||!['',undefined,'5432'].includes(env.PGPORT)||env.PGSSLMODE!=='verify-full'||!env.SUPABASE_SERVICE_ROLE_KEY)fail();
 return {origin:'https://'+ref+'.supabase.co',token:env.SUPABASE_SERVICE_ROLE_KEY};
}
async function download(entry,root,{origin,token},fetcher,signal){
 const url=new URL('/storage/v1/object/authenticated/ynsg-customer-files/'+entry.path,origin);
 const response=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token,apikey:token},redirect:'error',signal});
 if(!response.ok||!response.body)fail();
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==entry.bytes))fail();
 await mkdir(join(root,entry.organization),{mode:0o700,recursive:true});
 const file=await open(join(root,entry.path),'wx',0o600),hash=createHash('sha256');let bytes=0;
 try{for await(const chunk of response.body){bytes+=chunk.length;if(bytes>entry.bytes)fail();hash.update(chunk);await file.writeFile(chunk);}if(bytes!==entry.bytes||hash.digest('hex')!==entry.sha256)fail();await file.sync();}finally{await file.close();}
}
export async function captureRecovery({keyPath,output,candidate,source,database,fetcher=fetch,signal=AbortSignal.timeout(20*60*1000)}){
 if(!/^[a-f0-9]{40}$/.test(candidate)||!source||!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(source.origin)||typeof source.token!=='string'||!source.token)fail();
 const parent=resolve(dirname(output));if(await realpath(parent)!==parent||(await stat(parent)).mode&0o077)fail();
 // Validate key before opening a remote snapshot. No secret bytes are read here.
 const key=await open(resolve(keyPath),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const s=await key.stat();if(!s.isFile()||s.size!==32||(s.mode&0o077)||await realpath(resolve(keyPath))!==resolve(keyPath))fail();}finally{await key.close();}
 const stage=await mkdtemp(join(parent,'.ynsg-source-'));let snapshot;
 try{
  signal.throwIfAborted();snapshot=await database.open();
  const manifest={format:'ynsg-customer-file-backup-v1',files:snapshot.catalog.files};
  const checked=reconcileRecoveryCatalog(snapshot.catalog,manifest);
  if(manifest.files.reduce((n,e)=>n+e.bytes,0)>LIMIT)fail();
  const dump=join(stage,'database.dump'),manifestPath=join(stage,'manifest.json'),root=join(stage,'files');
  await mkdir(root,{mode:0o700});await writeFile(manifestPath,JSON.stringify(manifest),{mode:0o600,flag:'wx'});
  if(!snapshot.alive())fail();await database.dump(snapshot.snapshot,dump);if(!snapshot.alive())fail();
  for(const entry of manifest.files){signal.throwIfAborted();await download(entry,root,source,fetcher,signal);}
  if(!snapshot.alive())fail();await snapshot.close();snapshot=null;
  signal.throwIfAborted();const result=await packRecoveryBundle({keyPath,dumpPath:dump,manifestPath,filesRoot:root,output,candidate,signal});
  return {...result,pendingExcluded:checked.pendingExcluded};
 }finally{if(snapshot)await snapshot.close().catch(()=>{});database.stop();await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [keyPath,output,candidate,...extra]=process.argv.slice(2);
 if(!candidate||extra.length){process.stderr.write('Usage: capture-recovery.mjs PRIVATE_KEY NEW_ENCRYPTED_BUNDLE CANDIDATE_SHA\n');process.exitCode=2;}
 else {const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20*60*1000);let db;
  for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>controller.abort());
  Promise.resolve().then(()=>{const source=sourceConfiguration(process.env);db=snapshotDatabase({signal:controller.signal});return captureRecovery({keyPath,output,candidate,source,database:db,signal:controller.signal});})
   .then(result=>process.stdout.write(JSON.stringify({ok:true,...result})+'\n'))
   .catch(()=>{process.stderr.write('Source capture failed. No successful backup is claimed. Review the private destination before retrying.\n');process.exitCode=1;})
   .finally(()=>{clearTimeout(timer);db?.stop();});
 }
}
