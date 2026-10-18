import {constants} from 'node:fs';
import {open,realpath,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {manifestParse} from './recovery-bundle.mjs';
import {verifyCustomerFileRestore} from './verify-customer-file-restore.mjs';

const MAX_JSON=4*1024**2;
const fail=()=>{throw Error('RECOVERY_CATALOG_MISMATCH');};
// Files are restricted evidence, not unbounded or symlink-following JSON reads.
async function jsonFile(path){
 const canonical=resolve(path);
 if(await realpath(canonical)!==canonical||!(await lstat(canonical)).isFile())fail();
 const file=await open(canonical,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const before=await file.stat();
  if(!before.isFile()||before.size<2||before.size>MAX_JSON||(before.mode&0o077)!==0)fail();
  const bytes=Buffer.alloc(before.size);let position=0;
  while(position<bytes.length){const result=await file.read(bytes,position,bytes.length-position,position);if(!result.bytesRead)fail();position+=result.bytesRead;}
  const after=await file.stat();
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail();
  return JSON.parse(bytes.toString('utf8'));
 }finally{await file.close();}
}

// Comparison is pure and order-independent; no count-only acceptance.
export function reconcileRecoveryCatalog(catalog,manifest){
 if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)||
  Object.keys(catalog).sort().join(',')!=='files,format,pendingCount,readyCount'||
  catalog.format!=='ynsg-recovery-file-catalog-v1'||
  !Number.isSafeInteger(catalog.readyCount)||catalog.readyCount<0||catalog.readyCount>10000||
  !Number.isSafeInteger(catalog.pendingCount)||catalog.pendingCount<0)fail();
 const expected=manifestParse({format:'ynsg-customer-file-backup-v1',files:catalog.files});
 manifestParse(manifest);
 if(expected.files.length!==catalog.readyCount||manifest.files.length!==catalog.readyCount)fail();
 const byPath=new Map(expected.files.map(file=>[file.path,file]));
 for(const file of manifest.files){
  const row=byPath.get(file.path);
  if(!row||['organization','id','path','bytes','mime','sha256'].some(key=>row[key]!==file[key]))fail();
 }
 return {verified:catalog.readyCount,pendingExcluded:catalog.pendingCount};
}

export async function verifyRecoveryCatalog({catalogPath,manifestPath,filesRoot}){
 const catalog=await jsonFile(catalogPath),manifest=await jsonFile(manifestPath);
 const result=reconcileRecoveryCatalog(catalog,manifest);
 // Independently check actual recovered bytes, not merely matching JSON.
 const checked=await verifyCustomerFileRestore(manifestPath,filesRoot);
 if(checked.verified!==result.verified)fail();
 // Detect replacement of either evidence file while the object checker ran.
 const finalCatalog=await jsonFile(catalogPath),finalManifest=await jsonFile(manifestPath);
 if(JSON.stringify(finalCatalog)!==JSON.stringify(catalog)||JSON.stringify(finalManifest)!==JSON.stringify(manifest))fail();
 return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==5){process.stderr.write('Usage: verify-recovery-catalog.mjs PRIVATE_CATALOG PRIVATE_MANIFEST RECOVERED_FILES\n');process.exitCode=2;}
 else verifyRecoveryCatalog({catalogPath:process.argv[2],manifestPath:process.argv[3],filesRoot:process.argv[4]})
  .then(result=>process.stdout.write(JSON.stringify({ok:true,...result})+'\n'))
  .catch(()=>{process.stderr.write('Recovery catalog verification failed. Keep recovery isolated; review restricted evidence.\n');process.exitCode=1;});
}
