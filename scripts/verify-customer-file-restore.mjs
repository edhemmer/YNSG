import {createHash} from 'node:crypto';
import {readFile,realpath,lstat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

export async function verifyCustomerFileRestore(manifestPath,backupRoot){
 const root=await realpath(backupRoot);
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 if(manifest?.format!=='ynsg-customer-file-backup-v1'||!Array.isArray(manifest?.files))
  throw Error('Unsupported private attachment backup manifest.');
 const ids=new Set(),paths=new Set(),results=[];
 for(const entry of manifest.files){
  if(!entry||typeof entry!=='object'||typeof entry.organization!=='string'||typeof entry.id!=='string'||
    !/^[a-f0-9-]{36}$/i.test(entry.organization)||!/^[a-f0-9-]{36}$/i.test(entry.id)||
    entry.path!==entry.organization+'/'+entry.id||paths.has(entry.path)||ids.has(entry.organization+':'+entry.id)||
    !Number.isSafeInteger(entry.bytes)||entry.bytes<8||entry.bytes>8388608||
    typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||
    !['image/png','image/jpeg'].includes(entry.mime))
   throw Error('Invalid or duplicate private attachment manifest entry.');
  paths.add(entry.path);ids.add(entry.organization+':'+entry.id);
  const candidate=resolve(root,entry.path);
  if(!candidate.startsWith(root+sep))throw Error('Private attachment escapes the restore directory.');
  const stat=await lstat(candidate);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Private attachment is not a regular file.');
  const real=await realpath(candidate);
  if(real!==candidate||!real.startsWith(root+sep))throw Error('Private attachment resolves outside the backup root.');
  if(stat.size!==entry.bytes)throw Error('Private attachment backup byte count mismatch.');
  const data=await readFile(candidate);
  const hash=createHash('sha256').update(data).digest('hex');
  if(hash!==entry.sha256)throw Error('Private attachment backup digest mismatch.');
  const png=[137,80,78,71,13,10,26,10].every((b,i)=>data[i]===b);
  const jpg=data[0]===255&&data[1]===216&&data[2]===255&&data.at(-2)===255&&data.at(-1)===217;
  if(entry.mime==='image/png'?!png:!jpg)throw Error('Private attachment backup file type mismatch.');
  results.push({organization:entry.organization,id:entry.id,sha256:hash,bytes:stat.size});
 }
 return {verified:results.length,files:results};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
 if(process.argv.length!==4){process.stderr.write('Usage: node scripts/verify-customer-file-restore.mjs manifest.json /isolated/backup/root\n');process.exitCode=2;}
 else verifyCustomerFileRestore(process.argv[2],process.argv[3]).then(result=>{
  process.stdout.write(JSON.stringify({verified:result.verified,valid:true})+'\n');
 }).catch(error=>{process.stderr.write(String(error.message)+'\n');process.exitCode=1;});
}
