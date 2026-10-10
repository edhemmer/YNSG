import {billingLabel} from './invoice-billing.ts';
import {PDFDocument,rgb,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {InvoiceDocument} from './invoice-document.js';
async function fontAsset(name:string){
 const relative=join('node_modules','dejavu-fonts-ttf',name);
 try{return await readFile(join(process.cwd(),relative));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return readFile(join(process.cwd(),'apps','web',relative));
}
let fontBytes:Promise<Buffer>|undefined,boldBytes:Promise<Buffer>|undefined;
async function logoAsset(){try{return await readFile(join(process.cwd(),'public','brand','ynsg-logo.jpg'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}return readFile(join(process.cwd(),'apps','web','public','brand','ynsg-logo.jpg'));}
export async function invoicePdf(invoice:InvoiceDocument){
 if(!invoice.recipient)throw Error('INVOICE_CUSTOMER_DETAILS_REQUIRED');
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(await(fontBytes??=fontAsset('ttf/DejaVuSans.ttf')),{subset:true});
 const bold=await pdf.embedFont(await(boldBytes??=fontAsset('ttf/DejaVuSans-Bold.ttf')),{subset:true});
 const logo=await pdf.embedJpg(await logoAsset());
 const supported=new Set(font.getCharacterSet());
 const clean=(value:string)=>{const normalized=value.replace(/\r\n?/g,'\n').replace(/\t/g,'    ');for(const char of normalized){if(char!=='\n'&&!supported.has(char.codePointAt(0)!))throw Error('INVOICE_PDF_UNSUPPORTED_CHARACTER');}return normalized;};
 const ink=rgb(.063,.157,.235),green=rgb(.192,.345,.259),gold=rgb(.776,.639,.357),cream=rgb(.973,.969,.945),muted=rgb(.36,.42,.46),lineColor=rgb(.86,.89,.86),white=rgb(1,1,1);
 const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 pdf.setTitle(`${invoice.sample?'SAMPLE - NOT A BILL - ':''}${invoice.businessName} - Invoice ${invoice.number}`);pdf.setAuthor(invoice.businessName);pdf.setCreator('Service invoice');pdf.setProducer('Service invoice');pdf.setCreationDate(new Date(invoice.issuedAt));pdf.setModificationDate(new Date(invoice.issuedAt));
 let page!:PDFPage,y=0,work=false;
 const wrap=(value:string,width=516,size=11,face:PDFFont=font)=>{const lines:string[]=[];for(const paragraph of clean(value).split('\n')){let line='';for(const char of paragraph){if(line&&face.widthOfTextAtSize(line+char,size)>width){const split=line.lastIndexOf(' ');if(split>0){lines.push(line.slice(0,split));line=line.slice(split+1)+char;}else{lines.push(line);line=char;}}else line+=char;}lines.push(line);}return lines;};
 const draw=(value:string,x:number,at:number,size=11,face:PDFFont=font,color=ink)=>page.drawText(clean(value),{x,y:at,size,font:face,color});
 function tableHead(){ensure(34);page.drawRectangle({x:48,y:y-10,width:516,height:30,color:ink});draw('DESCRIPTION',60,y,9,bold,white);draw('AMOUNT',506,y,9,bold,white);y-=34;}
 function newPage(){
  if(pdf.getPageCount()>=100)throw Error('INVOICE_PDF_TOO_LONG');page=pdf.addPage([612,792]);
  page.drawImage(logo,{x:48,y:650,width:180,height:120});
  draw('SERVICE INVOICE',370,741,9,bold,green);
  const identity=wrap(`Invoice #${invoice.number}`,194,24,bold);let identityY=707;for(const value of identity){draw(value,370,identityY,24,bold);identityY-=29;}
  const status=invoice.sample?'SAMPLE INVOICE':invoice.balanceCents===0?(invoice.paidCents>0?'PAID':'NO BALANCE DUE'):invoice.paidCents>0?'PARTIALLY PAID':'PAYMENT DUE';
  draw(status,370,identityY-3,9,bold,green);
  y=Math.min(650,identityY-14);page.drawRectangle({x:48,y,width:516,height:3,color:gold});y-=26;
  if(invoice.sample){draw('SAMPLE - NOT A BILL. No work or payment has been recorded.',48,y,10,bold,green);y-=25;}
  if(work)tableHead();
 }
 function ensure(height=18){if(y-height<72)newPage();}
 function text(value:string,size=11,gap=10,face:PDFFont=font,color=ink){const lines=wrap(value,516,size,face);if(lines.length*(size+6)<=430)ensure(lines.length*(size+6));for(const value of lines){ensure(size+6);draw(value,48,y,size,face,color);y-=size+6;}y-=gap;}
 newPage();
 draw('BILLED TO / SERVICE ADDRESS',48,y,9,bold,green);draw('INVOICE DETAILS',332,y,9,bold,green);y-=23;
 const customer=invoice.recipient;
 const nameLines=wrap(customer.name,256,13,bold);
 const customerLines=[...nameLines,...wrap([customer.street,[customer.city,customer.region,customer.postalCode].filter(Boolean).join(', '),customer.email,customer.phone].join('\n'),256,10)];
 const details=wrap(['Issued '+new Date(invoice.issuedAt).toLocaleDateString('en-US',{timeZone:invoice.timezone,month:'long',day:'numeric',year:'numeric'}),...(invoice.dueDate?['Due date '+invoice.dueDate]:[]),invoice.businessName,...(invoice.businessEmail?[invoice.businessEmail]:[])].join('\n'),232,10);
 // Column content flows together, including unusually long recipient and seller names.
 for(let i=0;i<Math.max(customerLines.length,details.length);i++){ensure(18);if(customerLines[i]!==undefined)draw(customerLines[i]!,48,y,i<nameLines.length?13:10,i<nameLines.length?bold:font);if(details[i]!==undefined)draw(details[i]!,332,y,10,font,muted);y-=16;}
 y-=12;text('Services & charges',17,4,bold);work=true;tableHead();
 for(const item of invoice.lines){
  const description=wrap(item.description,365,11,bold);
  const detail=wrap(billingLabel(item)+(item.recordedMinutes!==undefined?` · ${item.recordedMinutes} actual minutes recorded`:''),365,9);
  const height=description.length*17+detail.length*14+24;if(height<=430)ensure(height);
  let first=true;
  for(const value of description){ensure(17);draw(value,60,y,11,bold);if(first){const amount=item.chargedCents?money(item.chargedCents):'No charge';draw(amount,552-font.widthOfTextAtSize(amount,11),y,11);first=false;}y-=17;}
  y-=3;for(const value of detail){ensure(14);draw(value,60,y,9,font,muted);y-=14;}
  y-=4;ensure(8);page.drawLine({start:{x:48,y},end:{x:564,y},thickness:.6,color:lineColor});y-=10;
 }
 work=false;
 const amounts=[['Subtotal',invoice.subtotalCents??invoice.totalCents],...(invoice.taxComponents?.length?invoice.taxComponents.map(c=>[`${c.label} (${c.ratePpm/10000}%)`,c.taxCents] as const):[['Sales tax',invoice.taxCents??0] as const]),['Invoice total',invoice.totalCents],['Confirmed payments',invoice.paidCents]] as const;
 const amountHeight=amounts.reduce((h,[label])=>h+Math.max(1,wrap(label,150,10).length)*15+12,0)+86;
 ensure(Math.min(amountHeight,430));
 const termsLines=wrap(invoice.terms.trimEnd(),230,10);
 const sideTerms=termsLines.length*16+54<=amountHeight && amountHeight<=430;
 if(sideTerms){draw('PAYMENT TERMS',48,y,9,bold,green);let termsY=y-23;for(const value of termsLines){draw(value,48,termsY,10,font,muted);termsY-=16;}if(invoice.sample){for(const value of wrap('No payment is due for this sample.',230,9)){draw(value,48,termsY-10,9,font,muted);termsY-=15;}}}
 for(const [label,value] of amounts){const labels=wrap(label,150,10,label==='Invoice total'?bold:font);const height=labels.length*15+12;ensure(height);page.drawRectangle({x:306,y:y-height+13,width:258,height,color:cream});const start=y;for(const value of labels){draw(value,320,y,10,label==='Invoice total'?bold:font);y-=15;}const amount=money(value);draw(amount,550-font.widthOfTextAtSize(amount,10),start,10,label==='Invoice total'?bold:font);y-=12;}
 ensure(76);page.drawRectangle({x:306,y:y-55,width:258,height:67,color:ink});draw(invoice.sample?'Sample balance':'Remaining balance',320,y-7,10,font,white);const balance=money(invoice.balanceCents);draw(balance,550-bold.widthOfTextAtSize(balance,22),y-34,22,bold,white);y-=80;
 if(!sideTerms){if(invoice.sample)text('No payment is due for this sample.',9,4,font,muted);ensure(58);text('PAYMENT TERMS',9,3,bold,green);text(invoice.terms.trimEnd(),10,0,font,muted);}
 const pages=pdf.getPages();for(let i=0;i<pages.length;i++){const p=pages[i]!;p.drawLine({start:{x:48,y:52},end:{x:564,y:52},thickness:.6,color:lineColor});p.drawText(`Invoice ${invoice.number} | Page ${i+1} of ${pages.length}`,{x:48,y:35,size:9,font,color:muted});}
 await pdf.attach(await fontAsset('LICENSE'),'DejaVu-font-license.txt',{mimeType:'text/plain',description:'License for the embedded DejaVu Sans font'});
 const output=await pdf.save();if(output.length>5*1024*1024)throw Error('INVOICE_PDF_TOO_LARGE');return output;
}
