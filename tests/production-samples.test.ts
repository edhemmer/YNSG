import test from 'node:test';
import assert from 'node:assert/strict';
import {productionSamples} from '../apps/web/lib/production-samples.ts';
import {emailRaw} from '../apps/web/lib/google-core.ts';
import {invoicePdf} from '../apps/web/lib/invoice-pdf.ts';
import {PDFDocument} from '../apps/web/node_modules/pdf-lib/cjs/index.js';
const settings={displayName:'Synthetic Business',sellerLegalName:'Synthetic Legal Business',timezone:'America/Chicago',notificationRecipient:'owner@example.invalid',sender:'owner@example.invalid',invoiceTerms:null,review:{enabled:true,url:'https://review.example.invalid/real-business-review'}};
const suite=()=>productionSamples(settings,'00000000-0000-4000-8000-000000000001','owner@example.invalid','https://crm.example.invalid','00000000-0000-4000-8000-000000000002',new Date('2026-10-10T00:00:00Z'));
test('sample set covers every current business template and routes only to the owner',()=>{
 const result=suite();assert.equal(result.messages.length,15);assert.equal(new Set(result.messages.map(m=>m.id)).size,15);
 for(const m of result.messages){assert.equal(m.to,'owner@example.invalid');assert.match(m.subject,/^\[SAMPLE /);assert.match(m.body,/No appointment, bill or payment/);if(m.id==='invoice.paid'){assert.ok(m.body.includes(settings.review.url));assert.ok(m.html.includes(settings.review.url));assert.match(m.body,/do not submit a review/);}else{assert.ok(!m.body.includes(settings.review.url));assert.ok(!m.html.includes(settings.review.url));}assert.ok(!m.html.includes('/request/manage'));}
 assert.ok(result.messages.some(m=>m.audience==='owner'));assert.ok(result.messages.some(m=>m.audience==='customer'));assert.equal(result.messages.filter(m=>m.pdf).length,1);
});
test('saved invoice preview preserves money arithmetic, sample label and missing-settings guidance',()=>{
 const {invoice,settingsWarnings}=suite();assert.equal(invoice.totalCents,12000);assert.equal(invoice.balanceCents,12000);assert.equal(invoice.paidCents,0);assert.equal(invoice.sample,true);
 assert.equal(invoice.lines.reduce((n,l)=>n+l.chargedCents,0),12000);assert.match(invoice.terms,/NOT A BILL/);assert.ok(settingsWarnings.some(w=>w.includes('invoice terms')));assert.equal(settings.invoiceTerms,null);
});
test('preview refuses arbitrary recipients and unsafe application origins',()=>{
 assert.throws(()=>productionSamples(settings,'org','stranger@example.invalid','https://crm.example.invalid','run'),/RECIPIENT/);
 assert.throws(()=>productionSamples(settings,'org','owner@example.invalid','http://crm.example.invalid','run'),/ORIGIN/);
});
test('sample PDF is a real invoice PDF with explicit sample metadata',async()=>{
 const document=await PDFDocument.load(await invoicePdf(suite().invoice));assert.match(document.getTitle()||'',/SAMPLE - NOT A BILL/);assert.ok(document.getPageCount()>0);
});

test('every sample survives the exact production MIME header and attachment validation',async()=>{
 const result=suite();
 for(const m of result.messages){
 const bytes=m.pdf?await invoicePdf(result.invoice):null;
 const raw=emailRaw(settings.sender,m.to,m.subject,m.body,'ynsg-sample-00000000-0000-4000-8000-000000000002-'+m.id.replace(/[^a-z0-9-]/g,'-'),{fromName:settings.displayName,html:m.html,...(bytes?{attachment:{filename:'invoice-1.pdf',bytes}}:{})});
 assert.match(Buffer.from(raw,'base64url').toString(),/MIME-Version: 1.0/);
 if(m.pdf)assert.match(Buffer.from(raw,'base64url').toString(),/filename="invoice-1.pdf"/);
 }
});
