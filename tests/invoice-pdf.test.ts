import test from 'node:test';import assert from 'node:assert/strict';
import {invoicePdf} from '../apps/web/lib/invoice-pdf.ts';import {emailRaw} from '../apps/web/lib/google-core.ts';import {invoiceDocument} from '../apps/web/lib/invoice-document.ts';
export const pdfFixture=invoiceDocument({number:12,issued_at:'2026-10-03T14:00:00Z',total_cents:4500,payments:[{cents:1500}],snapshot:{configuration:{sellerLegalName:'Synthetic Service Company',invoiceTerms:'Agreed terms. Customer prepays supplier directly for mulch. No payment information is stored.',timezone:'America/Chicago',notificationRecipient:'owner@example.invalid'},recipient:{name:'Renée Test',email:'customer@example.invalid',phone:'5550000000',street:'100 Synthetic Street',city:'Test City',region:'IL',postalCode:''},recordedWork:[{description:'Garden work and mulch',chargedCents:4500,waiverReason:''},{description:'Door adjustment',chargedCents:0,waiverReason:'PRIVATE'}]}});
test('invoice PDF and MIME attachment round-trip with safe filename and no private records',async()=>{
 const bytes=await invoicePdf(pdfFixture);assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
 const raw=Buffer.from(emailRaw('owner@example.invalid','customer@example.invalid','Invoice 12','Plain text','ynsg-invoice-12',{html:'<p>Invoice</p>',attachment:{filename:'invoice-12.pdf',bytes}}),'base64url').toString();
 assert.ok(raw.includes('multipart/mixed'));assert.ok(raw.includes('multipart/alternative'));assert.ok(raw.includes('Content-Disposition: attachment; filename="invoice-12.pdf"'));
 const encoded=raw.match(/Content-Type: application\/pdf;[^]*?Content-Transfer-Encoding: base64\r\n\r\n([^]*?)\r\n--ynsg-mixed-/)?.[1];assert.ok(encoded);assert.deepEqual(Buffer.from(encoded.replace(/\r\n/g,''),'base64'),Buffer.from(bytes));
 assert.throws(()=>emailRaw('owner@example.invalid','customer@example.invalid','Invoice','Text','ynsg-test',{attachment:{filename:'invoice.pdf\r\nBcc: bad@example.invalid',bytes}}));
});
test('PDF refuses absent recipient and unsupported characters instead of silently changing customer text',async()=>{
 await assert.rejects(invoicePdf({...pdfFixture,recipient:null}));
 await assert.rejects(invoicePdf({...pdfFixture,businessName:'Test \u{10ffff}'}),/UNSUPPORTED_CHARACTER/);
});
test('monthly invoice and sample attachment names preserve PDF bytes while unsafe names remain rejected',async()=>{
 const bytes=await invoicePdf(pdfFixture);
 for(const filename of ['invoice-202610-0001.pdf','invoice-202701-0008.pdf','invoice-202610-10000.pdf','sample-invoice-202610-0001-not-a-bill.pdf']){
  const raw=Buffer.from(emailRaw('owner@example.invalid','customer@example.invalid','Invoice','Text','ynsg-monthly-invoice',{attachment:{filename,bytes}}),'base64url').toString();
  assert.ok(raw.includes(`Content-Disposition: attachment; filename="${filename}"`));
  const encoded=raw.match(/Content-Type: application\/pdf;[^]*?Content-Transfer-Encoding: base64\r\n\r\n([^]*?)\r\n--ynsg-mixed-/)?.[1];assert.ok(encoded);assert.deepEqual(Buffer.from(encoded.replace(/\r\n/g,''),'base64'),Buffer.from(bytes));
 }
 for(const filename of ['../invoice-202610-0001.pdf','invoice-202613-0001.pdf','invoice-202610-0001.pdf\r\nBcc: attacker@example.invalid','sample-invoice-202610-0001.pdf','invoice-202610-0001.exe'])assert.throws(()=>emailRaw('owner@example.invalid','customer@example.invalid','Invoice','Text','ynsg-test',{attachment:{filename,bytes}}),/INVALID_ATTACHMENT/);
 assert.throws(()=>emailRaw('owner@example.invalid','customer@example.invalid','Invoice','Text','ynsg-test',{attachment:{filename:'invoice-202610-0001.pdf',bytes:Buffer.from('not a PDF')}}),/INVALID_ATTACHMENT/);
});

test('branded PDF keeps a short invoice on one page and paginates long services without losing metadata',async()=>{
 const {PDFDocument}=await import('../apps/web/node_modules/pdf-lib/cjs/index.js');
 const short=await PDFDocument.load(await invoicePdf(pdfFixture));assert.equal(short.getPageCount(),1);assert.equal(short.getAuthor(),pdfFixture.businessName);
 const long=await PDFDocument.load(await invoicePdf({...pdfFixture,businessName:'Long recorded seller name '.repeat(12),lines:Array.from({length:36},(_,i)=>({...pdfFixture.lines[0]!,description:`Service ${i+1}: `+'Long approved service description. '.repeat(8)}))}));
 assert.ok(long.getPageCount()>1);assert.ok(long.getPageCount()<100);for(const page of long.getPages()){assert.equal(page.getWidth(),612);assert.equal(page.getHeight(),792);}
});

test('credit PDF keeps original issue metadata, dates modification at retained adjustment and renders safely',async()=>{
 const {PDFDocument}=await import('../apps/web/node_modules/pdf-lib/cjs/index.js');
 const credit={id:'40000000-0000-4000-8000-000000000001',invoiceId:'30000000-0000-4000-8000-000000000001',subtotalCents:1000,totalCents:1000,taxComponents:[],reason:'Synthetic reviewed invoice credit',issuedAt:'2026-10-19T12:00:00Z',reversesId:null};
 const adjusted={...pdfFixture,credits:[credit],creditCents:1000,balanceCents:2000};
 const pdf=await PDFDocument.load(await invoicePdf(adjusted),{updateMetadata:false});assert.equal(pdf.getCreationDate()?.toISOString(),new Date(pdfFixture.issuedAt).toISOString());assert.equal(pdf.getModificationDate()?.toISOString(),new Date(credit.issuedAt).toISOString());assert.equal(pdf.getPageCount(),2);
});
