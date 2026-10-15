import {z} from 'zod';

// Private job evidence only. No public URLs, user-supplied storage paths or overwrite.
export const MAX_PRIVATE_ATTACHMENT_BYTES=8*1024*1024;
export const MAX_PRIVATE_ATTACHMENT_NAME=120;
export const privateAttachmentKind=z.enum(['job_photo','job_document','expense_receipt']);
export const privateAttachmentInput=z.object({
 organization:z.uuid(),parentId:z.uuid(),kind:privateAttachmentKind,
 filename:z.string().min(1).max(MAX_PRIVATE_ATTACHMENT_NAME),
 contentType:z.enum(['image/jpeg','image/png','image/webp','application/pdf']),
 bytes:z.number().int().positive().max(MAX_PRIVATE_ATTACHMENT_BYTES),
}).strict();
export type PrivateAttachmentInput=z.infer<typeof privateAttachmentInput>;

export function safeAttachmentName(name:string){
 const normalized=name.normalize('NFKC').trim();
 if(!normalized||normalized.length>MAX_PRIVATE_ATTACHMENT_NAME||/[\\/\u0000-\u001f\u007f]/.test(normalized)||normalized==='.'||normalized==='..'||normalized.startsWith('.'))throw Error('INVALID_ATTACHMENT_NAME');
 if(/\.(?:svg|html?|js|exe|sh|bat|php|heic)$/i.test(normalized))throw Error('UNSUPPORTED_ATTACHMENT');
 return normalized;
}
export function inspectPrivateAttachment(value:unknown,bytes:Uint8Array){
 const input=privateAttachmentInput.parse(value);
 safeAttachmentName(input.filename);
 if(!(bytes instanceof Uint8Array)||bytes.byteLength!==input.bytes||bytes.byteLength>MAX_PRIVATE_ATTACHMENT_BYTES)throw Error('INVALID_ATTACHMENT_SIZE');
 const head=bytes.subarray(0,16);
 const starts=(...signature:number[])=>signature.every((n,i)=>head[i]===n);
 const match=input.contentType==='image/jpeg'?starts(0xff,0xd8,0xff):
 input.contentType==='image/png'?starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a):
 input.contentType==='image/webp'?starts(0x52,0x49,0x46,0x46)&&String.fromCharCode(...head.subarray(8,12))==='WEBP':
 starts(0x25,0x50,0x44,0x46,0x2d);
 if(!match)throw Error('ATTACHMENT_SIGNATURE_MISMATCH');
 // Signature checks are preliminary, not malware scanning or file parsing.
 return input;
}
export function privateAttachmentObjectPath(organization:string,parentId:string,attachmentId:string){
 const uuid=z.uuid();
 const org=uuid.parse(organization),parent=uuid.parse(parentId),attachment=uuid.parse(attachmentId);
 return org+'/'+parent+'/'+attachment;
}
