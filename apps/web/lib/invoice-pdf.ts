import {PDFDocument,rgb,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {InvoiceDocument} from './invoice-document.js';
async function fontAsset(name:string){
 const relative=join('node_modules','dejavu-fonts-ttf',name);
 try{return await readFile(join(process.cwd(),relative));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return readFile(join(process.cwd(),'apps','web',relative));
}
let fontBytes:Promise<Buffer>|undefined;
export async function invoicePdf(invoice:InvoiceDocument){
 if(!invoice.recipient)throw Error('INVOICE_CUSTOMER_DETAILS_REQUIRED');
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const bytes=await (fontBytes??=fontAsset('ttf/DejaVuSans.ttf'));
 const font=await pdf.embedFont(bytes,{subset:true});
 const supported=new Set(font.getCharacterSet());
 const clean=(text:string)=>{const normalized=text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ');for(const char of normalized){if(char!=='\n'&&!supported.has(char.codePointAt(0)!))throw Error('INVOICE_PDF_UNSUPPORTED_CHARACTER');}return normalized;};
 const ink=rgb(16/255,40/255,60/255),green=rgb(49/255,88/255,66/255);
 const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 pdf.setTitle(`${invoice.businessName} - Invoice ${invoice.number}`);pdf.setAuthor(invoice.businessName);pdf.setCreator('Service invoice');pdf.setProducer('Service invoice');pdf.setCreationDate(new Date(invoice.issuedAt));pdf.setModificationDate(new Date(invoice.issuedAt));
 let page!:PDFPage;let y=0,work=false;
 const wrap=(value:string,width=516,size=12)=>{const lines:string[]=[];for(const paragraph of clean(value).split('\n')){let line='';for(const char of paragraph){if(line&&font.widthOfTextAtSize(line+char,size)>width){const split=line.lastIndexOf(' ');if(split>0){lines.push(line.slice(0,split));line=line.slice(split+1)+char;}else{lines.push(line);line=char;}}else line+=char;}lines.push(line);}return lines;};
 function newPage(){if(pdf.getPageCount()>=100)throw Error('INVOICE_PDF_TOO_LONG');page=pdf.addPage([612,792]);const names=wrap(invoice.businessName,516,16);for(let i=0;i<names.length;i++)page.drawText(names[i]!,{x:48,y:744-i*20,size:16,font,color:green});const top=716-(names.length-1)*20;page.drawText(`Invoice ${invoice.number}`,{x:48,y:top,size:22,font,color:ink});page.drawText(`Issued ${new Date(invoice.issuedAt).toLocaleDateString('en-US',{timeZone:invoice.timezone})}`,{x:48,y:top-24,size:11,font,color:ink});y=top-56;if(work){page.drawText('Work (continued)',{x:48,y,size:12,font,color:ink});page.drawText('Charge',{x:500,y,size:12,font,color:ink});y-=25;}}
 function ensure(height=18){if(y-height<72)newPage();}
 function text(value:string,size=12,gap=10){for(const paragraph of clean(value).split('\n')){const lines=wrap(paragraph,516,size);if(lines.length*(size+7)<=450)ensure(lines.length*(size+7));for(const line of lines){ensure(size+7);page.drawText(line,{x:48,y,size,font,color:ink});y-=size+7;}}y-=gap;}
 newPage();
 if(invoice.businessEmail)text(invoice.businessEmail,11,10);
 text('Customer and service address',14,4);
 const c=invoice.recipient;text([c.name,c.street,[c.city,c.region,c.postalCode].filter(Boolean).join(', '),c.email,c.phone].join('\n'),12,16);
 text('Recorded work and approved charges',14,4);work=true;
 for(const item of invoice.lines){const lines=wrap(item.description,390);if(lines.length*18+10<=450)ensure(lines.length*18+10);let first=true;for(const line of lines){ensure(18);page.drawText(line,{x:48,y,size:12,font,color:ink});if(first){const charge=item.chargedCents?money(item.chargedCents):'No charge';page.drawText(charge,{x:564-font.widthOfTextAtSize(charge,12),y,size:12,font,color:ink});first=false;}y-=18;}y-=10;}
 work=false;ensure(110);y-=8;
 for(const [label,value] of [['Invoice total',invoice.totalCents],['Confirmed payments',invoice.paidCents],['Remaining balance',invoice.balanceCents]] as const){ensure(22);page.drawText(label,{x:48,y,size:13,font,color:ink});const amount=money(value);page.drawText(amount,{x:564-font.widthOfTextAtSize(amount,13),y,size:13,font,color:ink});y-=24;}
 y-=16;ensure(50);text('Invoice terms',14,4);text(invoice.terms.trimEnd(),11);
 const pages=pdf.getPages();for(let i=0;i<pages.length;i++){pages[i]!.drawText(`Invoice ${invoice.number} | Page ${i+1} of ${pages.length}`,{x:48,y:36,size:10,font,color:ink});}
 await pdf.attach(await fontAsset('LICENSE'),'DejaVu-font-license.txt',{mimeType:'text/plain',description:'License for the embedded DejaVu Sans font'});
 const output=await pdf.save();if(output.length>5*1024*1024)throw Error('INVOICE_PDF_TOO_LARGE');return output;
}
