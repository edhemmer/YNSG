import {z} from 'zod';
export const customerFileQuery=z.object({organization:z.uuid(),customer:z.uuid()}).strict();
export const customerFileDownload=z.object({organization:z.uuid(),file:z.uuid()}).strict();
export const customerFilePurpose=z.enum(['job_photo','receipt','customer_document']);
export const customerFileRecord=z.object({id:z.uuid(),name:z.string().min(1).max(180),purpose:customerFilePurpose,mime:z.enum(['image/jpeg','image/png']),bytes:z.number().int().positive().max(8388608),createdAt:z.iso.datetime({offset:true})}).strict();
export const customerFileRecords=z.array(customerFileRecord).max(250);
export const customerFileReservation=z.object({id:z.uuid(),path:z.string(),ready:z.boolean()}).strict();
export const customerFileFinalize=z.object({id:z.uuid(),ready:z.literal(true)}).strict();
export function verifyImageBytes(file:Uint8Array,mime:string):boolean{
 if(file.length<8||file.length>8388608)return false;
 if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((x,i)=>file[i]===x);
 if(mime==='image/jpeg')return file[0]===0xff&&file[1]===0xd8&&file[2]===0xff&&file[file.length-2]===0xff&&file[file.length-1]===0xd9;
 return false;
}
export function validCustomerFilePath(organization:string,id:string,path:string){
 return path===organization+'/'+id;
}
