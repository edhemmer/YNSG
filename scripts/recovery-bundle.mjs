import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {constants} from 'node:fs';
import {open,realpath,stat,lstat,mkdir,mkdtemp,link,unlink,rm,rename} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {Readable,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
const MAX=32*1024**3,HEADER_MAX=4*1024**2,MAGIC=Buffer.from('YNSGREC1');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=/^[a-f0-9]{64}$/;
const shape=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function manifestParse(m){
 if(!shape(m,['format','files'])||m.format!=='ynsg-customer-file-backup-v1'||!Array.isArray(m.files)||m.files.length>10000)fail('INVALID_MANIFEST');
 const seen=new Set();for(const e of m.files){if(!shape(e,['organization','id','path','bytes','mime','sha256'])||typeof e.organization!=='string'||!uuid.test(e.organization)||typeof e.id!=='string'||!uuid.test(e.id)||e.path!==e.organization+'/'+e.id||seen.has(e.path)||!Number.isSafeInteger(e.bytes)||e.bytes<8||e.bytes>8388608||!['image/png','image/jpeg'].includes(e.mime)||typeof e.sha256!=='string'||!sha.test(e.sha256))fail('INVALID_MANIFEST');seen.add(e.path);}return m;
}
function headerParse(h){
 if(!shape(h,['format','candidate','createdAt','database','manifest'])||h.format!=='ynsg-recovery-payload-v1'||typeof h.candidate!=='string'||!/^[a-f0-9]{40}$/.test(h.candidate)||typeof h.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(h.createdAt)||!Number.isFinite(Date.parse(h.createdAt))||new Date(h.createdAt).toISOString()!==h.createdAt||!shape(h.database,['bytes','sha256'])||!Number.isSafeInteger(h.database.bytes)||h.database.bytes<5||h.database.bytes>MAX||typeof h.database.sha256!=='string'||!sha.test(h.database.sha256))fail('INVALID_HEADER');
 manifestParse(h.manifest);if(h.database.bytes+h.manifest.files.reduce((n,f)=>n+f.bytes,0)>MAX)fail('BUNDLE_TOO_LARGE');return h;
}
function verifyImageBytes(b,mime){return mime==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):b[0]===255&&b[1]===216&&b[2]===255&&b.at(-2)===255&&b.at(-1)===217;}
const fail=code=>{throw Error(code);};
const sink=h=>new Writable({write(chunk,_encoding,done){h.writeFile(chunk).then(()=>done(),done);}});
async function regular(path,max=MAX){const p=resolve(path);if(await realpath(p)!==p)fail('SYMLINK_REFUSED');if(!(await lstat(p)).isFile())fail('INVALID_SOURCE');const h=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const s=await h.stat();if(!s.isFile()||s.size>max)fail('INVALID_SOURCE');return {h,size:s.size,mode:s.mode};}catch(e){await h.close();throw e;}}
async function privateParent(path){const p=resolve(dirname(path));if(await realpath(p)!==p)fail('SYMLINK_REFUSED');const s=await stat(p);if(!s.isDirectory()||(s.mode&0o077)!==0)fail('PRIVATE_DIRECTORY_REQUIRED');return p;}
async function syncDirectory(path){const h=await open(path,constants.O_RDONLY|constants.O_DIRECTORY);try{await h.sync();}finally{await h.close();}}
async function keyBytes(path){const {h,size,mode}=await regular(path,32);try{if(size!==32||(mode&0o077)!==0)fail('PRIVATE_KEY_REQUIRED');const b=await exact(h,32,0);if((await h.stat()).size!==size)fail('SOURCE_CHANGED');return b;}finally{await h.close();}}
async function* chunks(h,size,start=0){let pos=start;while(pos<size){const b=Buffer.alloc(Math.min(65536,size-pos)),r=await h.read(b,0,b.length,pos);if(!r.bytesRead)fail('SOURCE_CHANGED');pos+=r.bytesRead;yield b.subarray(0,r.bytesRead);}if((await h.stat()).size!==size)fail('SOURCE_CHANGED');}
async function digest(h,size,signal){const hash=createHash('sha256');for await(const b of chunks(h,size)){signal?.throwIfAborted();hash.update(b);}return hash.digest('hex');}
async function exact(h,length,position){const b=Buffer.alloc(length);let got=0;while(got<length){const r=await h.read(b,got,length-got,position+got);if(!r.bytesRead)fail('TRUNCATED_BUNDLE');got+=r.bytesRead;}return b;}
async function image(root,e){const path=resolve(root,e.path);if(!path.startsWith(resolve(root)+'/'))fail('INVALID_SOURCE');const {h,size}=await regular(path,8388608);try{const b=await exact(h,size,0);if((await h.stat()).size!==size)fail('SOURCE_CHANGED');if(size!==e.bytes||b.length!==e.bytes||createHash('sha256').update(b).digest('hex')!==e.sha256||!verifyImageBytes(b,e.mime))fail('FILE_INTEGRITY_FAILED');return b;}finally{await h.close();}}
export async function generateRecoveryKey(path){await privateParent(path);const h=await open(path,'wx',0o600);try{await h.writeFile(randomBytes(32));await h.sync();}finally{await h.close();}await syncDirectory(dirname(resolve(path)));return {created:true};}
export async function packRecoveryBundle({keyPath,dumpPath,manifestPath,filesRoot,output,candidate,signal}){
 signal?.throwIfAborted();
 const parent=await privateParent(output),{h:mh,size:manifestBytes}=await regular(manifestPath,HEADER_MAX);let manifest;
 try{manifest=manifestParse(JSON.parse((await exact(mh,manifestBytes,0)).toString('utf8')));}finally{await mh.close();}
 const {h:db,size}=await regular(dumpPath);let stage,key;
 try{
  key=await keyBytes(keyPath);
  if((await exact(db,5,0)).toString()!=='PGDMP')fail('CUSTOM_DUMP_REQUIRED');
  const header=headerParse({format:'ynsg-recovery-payload-v1',candidate,createdAt:new Date().toISOString(),database:{bytes:size,sha256:await digest(db,size,signal)},manifest});
  const encoded=Buffer.from(JSON.stringify(header));if(encoded.length>HEADER_MAX)fail('HEADER_TOO_LARGE');
  const length=Buffer.alloc(4);length.writeUInt32BE(encoded.length);const nonce=randomBytes(12),prefix=Buffer.concat([MAGIC,nonce]),cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});cipher.setAAD(prefix);
  stage=await mkdtemp(join(parent,'.ynsg-pack-'));const temp=join(stage,'bundle'),out=await open(temp,'wx',0o600);
  async function* payload(){yield length;yield encoded;const hash=createHash('sha256');for await(const b of chunks(db,size)){hash.update(b);yield b;}if(hash.digest('hex')!==header.database.sha256)fail('SOURCE_CHANGED');for(const e of manifest.files){signal?.throwIfAborted();yield await image(filesRoot,e);}}
  try{await out.writeFile(prefix);await pipeline(Readable.from(payload()),cipher,sink(out),{signal});await out.writeFile(cipher.getAuthTag());await out.sync();}finally{await out.close();}
  signal?.throwIfAborted();await link(temp,resolve(output));await unlink(temp);await syncDirectory(parent);return {files:manifest.files.length,databaseBytes:size,candidate};
 }finally{await db.close();key?.fill(0);if(stage)await rm(stage,{recursive:true,force:true});}
}
export async function unpackRecoveryBundle({keyPath,bundlePath,outputDirectory}){
 await privateParent(outputDirectory);const {h:input,size}=await regular(bundlePath,MAX+HEADER_MAX+40);let owned=false,key;
 try{
  key=await keyBytes(keyPath);
  if(size<40)fail('TRUNCATED_BUNDLE');const prefix=await exact(input,20,0);if(!prefix.subarray(0,8).equals(MAGIC))fail('UNSUPPORTED_BUNDLE');
  await mkdir(outputDirectory,{mode:0o700});owned=true;const temp=join(outputDirectory,'.authenticated-payload'),plain=await open(temp,'wx+',0o600);
  try{const decipher=createDecipheriv('aes-256-gcm',key,prefix.subarray(8),{authTagLength:16});decipher.setAAD(prefix);decipher.setAuthTag(await exact(input,16,size-16));
   // No metadata is parsed and no recovered file is published until final() verifies GCM.
   async function* ciphertext(){let position=20;while(position<size-16){const bytes=await exact(input,Math.min(65536,size-16-position),position);position+=bytes.length;yield bytes;}}
   await pipeline(Readable.from(ciphertext()),decipher,sink(plain));await plain.sync();if((await input.stat()).size!==size)fail('SOURCE_CHANGED');
   const plainSize=(await plain.stat()).size,length=(await exact(plain,4,0)).readUInt32BE();if(length>HEADER_MAX||length<2)fail('INVALID_HEADER');
   const header=headerParse(JSON.parse((await exact(plain,length,4)).toString('utf8'))),expected=4+length+header.database.bytes+header.manifest.files.reduce((n,f)=>n+f.bytes,0);if(expected!==plainSize)fail('BUNDLE_LENGTH_MISMATCH');
   const recovered=join(outputDirectory,'.pending-recovery');await mkdir(recovered,{mode:0o700});let position=4+length;
   async function restore(path,bytes,expectedHash){const out=await open(path,'wx',0o600),hash=createHash('sha256');try{let left=bytes;while(left){const b=await exact(plain,Math.min(65536,left),position);position+=b.length;left-=b.length;hash.update(b);await out.writeFile(b);}if(hash.digest('hex')!==expectedHash)fail('RESTORE_INTEGRITY_FAILED');await out.sync();}finally{await out.close();}}
   await restore(join(recovered,'database.dump'),header.database.bytes,header.database.sha256);
   const dump=await regular(join(recovered,'database.dump'));try{if((await exact(dump.h,5,0)).toString()!=='PGDMP')fail('CUSTOM_DUMP_REQUIRED');}finally{await dump.h.close();}
   const fileRoot=join(recovered,'files');await mkdir(fileRoot,{mode:0o700});for(const e of header.manifest.files){await mkdir(join(fileRoot,e.organization),{mode:0o700,recursive:true});await restore(join(fileRoot,e.path),e.bytes,e.sha256);await image(fileRoot,e);}
   const manifestFile=await open(join(recovered,'manifest.json'),'wx',0o600);try{await manifestFile.writeFile(JSON.stringify(header.manifest,null,2)+'\n');await manifestFile.sync();}finally{await manifestFile.close();}
   for(const organization of new Set(header.manifest.files.map(f=>f.organization)))await syncDirectory(join(fileRoot,organization));await syncDirectory(fileRoot);
   const info=await open(join(recovered,'recovery.json'),'wx',0o600);try{await info.writeFile(JSON.stringify(header,null,2)+'\n');await info.sync();}finally{await info.close();}
   await syncDirectory(recovered);await plain.close();await unlink(temp);await rename(recovered,join(outputDirectory,'verified'));await syncDirectory(outputDirectory);await syncDirectory(dirname(resolve(outputDirectory)));return {files:header.manifest.files.length,databaseBytes:header.database.bytes,candidate:header.candidate};
  }finally{await plain.close().catch(()=>{});}
 }catch(e){if(owned)await rm(outputDirectory,{recursive:true,force:true});throw e;}
 finally{await input.close();key?.fill(0);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [action,...a]=process.argv.slice(2);let work;
 if(action==='keygen'&&a.length===1)work=()=>generateRecoveryKey(a[0]);
 else if(action==='pack'&&a.length===6)work=()=>packRecoveryBundle({keyPath:a[0],dumpPath:a[1],manifestPath:a[2],filesRoot:a[3],output:a[4],candidate:a[5]});
 else if(action==='unpack'&&a.length===3)work=()=>unpackRecoveryBundle({keyPath:a[0],bundlePath:a[1],outputDirectory:a[2]});
 if(!work){process.stderr.write('Usage: recovery-bundle.mjs keygen KEY | pack KEY DUMP MANIFEST FILE_ROOT OUTPUT CANDIDATE | unpack KEY BUNDLE NEW_PRIVATE_DIRECTORY\n');process.exitCode=2;}
 else work().then(result=>process.stdout.write(JSON.stringify({ok:true,...result})+'\n')).catch(()=>{process.stderr.write('Recovery operation could not be confirmed. Check the destination before retrying; existing files are not overwritten.\n');process.exitCode=1;});
}
