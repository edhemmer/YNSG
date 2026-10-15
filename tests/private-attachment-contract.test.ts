import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPrivateAttachment,privateAttachmentObjectPath,safeAttachmentName,MAX_PRIVATE_ATTACHMENT_BYTES} from '../apps/web/lib/private-attachment-contract.ts';

const org='20000000-0000-4000-8000-000000000001',parent='30000000-0000-4000-8000-000000000001',file='40000000-0000-4000-8000-000000000001';
const jpeg=Uint8Array.from([255,216,255,224,1,2]);
const meta={organization:org,parentId:parent,kind:'job_photo',filename:'before.jpg',contentType:'image/jpeg',bytes:jpeg.length};
test('small supported job evidence passes preliminary signature and schema checks',()=>{
 assert.equal(inspectPrivateAttachment(meta,jpeg).filename,'before.jpg');
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0]);
 assert.equal(inspectPrivateAttachment({...meta,filename:'after.png',contentType:'image/png',bytes:png.length},png).kind,'job_photo');
 const pdf=Uint8Array.from([37,80,68,70,45,49,46,55]);
 assert.equal(inspectPrivateAttachment({...meta,kind:'job_document',filename:'receipt.pdf',contentType:'application/pdf',bytes:pdf.length},pdf).kind,'job_document');
});
test('MIME spoofing, byte mismatches, huge uploads and unsupported content fail closed',()=>{
 for(const [m,b] of ([
  [{...meta,contentType:'application/pdf'},jpeg],
  [{...meta,bytes:jpeg.length+1},jpeg],
  [{...meta,bytes:MAX_PRIVATE_ATTACHMENT_BYTES+1},jpeg],
  [{...meta,contentType:'image/svg+xml'},jpeg],
  [{...meta,filename:'bad.svg'},jpeg],
  [{...meta,kind:'public_gallery'},jpeg],
  [{...meta,unexpected:true},jpeg],
 ] as Array<[unknown,Uint8Array]>))assert.throws(()=>inspectPrivateAttachment(m,b));
});
test('names cannot be paths, hidden dot files, scripts or contain control characters',()=>{
 for(const name of ['../photo.jpg','a\\b.jpg','.env','../','file.html','x.js','bad\u0000name.jpg','a'.repeat(121)])assert.throws(()=>safeAttachmentName(name));
 assert.equal(safeAttachmentName('  kitchen photo.jpg  '),'kitchen photo.jpg');
});
test('object key is fully server-assigned from three validated UUIDs, never filename',()=>{
 assert.equal(privateAttachmentObjectPath(org,parent,file),org+'/'+parent+'/'+file);
 for(const invalid of ['../other-company','not-a-uuid','','00000000-0000-0000-0000-000000000000/other'])assert.throws(()=>privateAttachmentObjectPath(invalid,parent,file));
});
