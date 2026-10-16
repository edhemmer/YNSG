import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyCustomerFileRestore} from '../scripts/verify-customer-file-restore.mjs';
const org='20000000-0000-4000-8000-000000000001';
const id='40000000-0000-4000-8000-000000000001';
const image=Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]);
async function fixture(){
 const folder=await mkdtemp(join(tmpdir(),'ynsg-file-restore-')),root=join(folder,'isolated');
 await mkdir(join(root,org),{recursive:true});
 await writeFile(join(root,org,id),image);
 const entry={organization:org,id,path:org+'/'+id,bytes:image.length,mime:'image/png',sha256:createHash('sha256').update(image).digest('hex')};
 const manifestPath=join(folder,'manifest.json');
 const save=async files=>writeFile(manifestPath,JSON.stringify({format:'ynsg-customer-file-backup-v1',files}));
 await save([entry]);return {folder,root,manifestPath,entry,save};
}
test('isolated backup manifest verifies exact restored image bytes and hash',async()=>{
 const f=await fixture();
 try{const r=await verifyCustomerFileRestore(f.manifestPath,f.root);assert.equal(r.verified,1);assert.equal(r.files[0].sha256,f.entry.sha256);}
 finally{await rm(f.folder,{recursive:true,force:true});}
});
test('restore fails closed on digest, size, duplicates and invalid object path',async()=>{
 const f=await fixture();
 try{
  for(const entry of [{...f.entry,sha256:'a'.repeat(64)},{...f.entry,bytes:10},{...f.entry,path:'../'+id}]){
   await f.save([entry]);await assert.rejects(verifyCustomerFileRestore(f.manifestPath,f.root));
  }
  await f.save([f.entry,f.entry]);await assert.rejects(verifyCustomerFileRestore(f.manifestPath,f.root));
 }finally{await rm(f.folder,{recursive:true,force:true});}
});
test('restore cannot follow symbolic links to substituted attachment bytes',async()=>{
 const f=await fixture();
 try{
  await rm(join(f.root,org,id));
  await symlink(f.manifestPath,join(f.root,org,id));
  await assert.rejects(verifyCustomerFileRestore(f.manifestPath,f.root));
 }finally{await rm(f.folder,{recursive:true,force:true});}
});
