import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {reconcileRecoveryCatalog,verifyRecoveryCatalog} from '../scripts/verify-recovery-catalog.mjs';
const image=Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]);
const entry=(n=1)=>{const organization=`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,id='40000000-0000-4000-8000-000000000001';return {organization,id,path:organization+'/'+id,bytes:image.length,mime:'image/png',sha256:createHash('sha256').update(image).digest('hex')};};
const manifest=files=>({format:'ynsg-customer-file-backup-v1',files});
const catalog=(files,pendingCount=0)=>({format:'ynsg-recovery-file-catalog-v1',readyCount:files.length,pendingCount,files});
test('reconciles every tenant and exact metadata independent of order; reports pending separately',()=>{
 assert.deepEqual(reconcileRecoveryCatalog(catalog([entry(1),entry(2)],3),manifest([entry(2),entry(1)])),{verified:2,pendingExcluded:3});
 assert.deepEqual(reconcileRecoveryCatalog(catalog([],2),manifest([])),{verified:0,pendingExcluded:2});
});
test('omission, extra rows, same-count substitution and false zero all fail',()=>{
 for(const files of [[],[entry(1)],[entry(1),entry(3)],[entry(1),entry(2),entry(3)]])assert.throws(()=>reconcileRecoveryCatalog(catalog([entry(1),entry(2)]),manifest(files)));
 assert.throws(()=>reconcileRecoveryCatalog({...catalog([]),readyCount:1},manifest([])));
});
test('matching IDs and counts cannot hide changed digest, bytes, MIME or path',()=>{
 for(const change of [{sha256:'b'.repeat(64)},{bytes:13},{mime:'image/jpeg'},{path:'../outside'},{organization:entry(2).organization},{unexpected:true}])assert.throws(()=>reconcileRecoveryCatalog(catalog([entry()]),manifest([{...entry(),...change}])));
});
test('invalid counts, duplicates, unsupported versions and oversized catalogs fail closed',()=>{
 for(const change of [{readyCount:-1},{readyCount:10001},{readyCount:0.5},{pendingCount:-1},{pendingCount:Infinity},{format:'future'},{extra:true},{files:[entry(),entry()],readyCount:2},{files:null}])assert.throws(()=>reconcileRecoveryCatalog({...catalog([entry()]),...change},manifest([entry()])));
});
async function fixture(run){const root=await mkdtemp(join(tmpdir(),'ynsg-catalog-'));try{const filesRoot=join(root,'files'),catalogPath=join(root,'catalog.json'),manifestPath=join(root,'manifest.json');await mkdir(join(filesRoot,entry().organization),{recursive:true});await writeFile(join(filesRoot,entry().path),image,{mode:0o600});await writeFile(catalogPath,JSON.stringify(catalog([entry()],1)),{mode:0o600});await writeFile(manifestPath,JSON.stringify(manifest([entry()])),{mode:0o600});await run({root,filesRoot,catalogPath,manifestPath});}finally{await rm(root,{recursive:true,force:true});}}
test('full verifier checks actual bytes and rejects corruption despite matching catalog and manifest',async()=>fixture(async args=>{
 assert.deepEqual(await verifyRecoveryCatalog(args),{verified:1,pendingExcluded:1});
 await writeFile(join(args.filesRoot,entry().path),Buffer.alloc(image.length));await assert.rejects(verifyRecoveryCatalog(args));
}));
test('evidence inputs must be private bounded regular files without symlinks',async()=>fixture(async args=>{
 const link=join(args.root,'link');await symlink(args.catalogPath,link);await assert.rejects(verifyRecoveryCatalog({...args,catalogPath:link}));
 await chmod(args.catalogPath,0o644);await assert.rejects(verifyRecoveryCatalog(args));await chmod(args.catalogPath,0o600);
 await writeFile(args.catalogPath,Buffer.alloc(4194305));await assert.rejects(verifyRecoveryCatalog(args));
}));
