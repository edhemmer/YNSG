import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUSINESS_INQUIRY_TYPES,businessInquiryEmail,businessConfirmationId} from '../lib/business-inquiry-email.js';

test('business inquiry form offers exactly the organization types the API accepts',async()=>{
 const page=await readFile('site/pages/business-community-partners.html','utf8');
 const options=[...page.matchAll(/<option>([^<]+)<\/option>/g)].map(m=>m[1].replaceAll('&amp;','&'));
 assert.deepEqual(options,[...BUSINESS_INQUIRY_TYPES]);
 assert.ok(BUSINESS_INQUIRY_TYPES.includes('Church or place of worship'));
});

test('confirmation explains next steps without promising price, insurance or credentials',()=>{
 const m=businessInquiryEmail({name:'Pat Synthetic',company:'Synthetic Fellowship <b>'});
 assert.match(m.subject,/Synthetic Fellowship/);
 assert.match(m.text,/^Hi Pat,/);
 assert.match(m.text,/within one business day/);
 assert.match(m.text,/written estimate before any work starts/);
 assert.doesNotMatch(m.text+m.html,/fixed price|not-to-exceed|every invoice/i);
 assert.doesNotMatch(m.html,/<b>/,'company name is escaped in HTML');
 assert.doesNotMatch(m.text+m.html,/insured|background[- ]checked|licensed|\$\d/i);
});

test('a retried inquiry reuses the same confirmation id',()=>{
 const key='5f0c9d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';
 assert.equal(businessConfirmationId(key),businessConfirmationId(key));
 assert.notEqual(businessConfirmationId(key),key);
 assert.match(businessConfirmationId(key),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('business page keeps public prices off and states the scope limits',async()=>{
 const page=await readFile('site/pages/business-community-partners.html','utf8');
 assert.doesNotMatch(page,/\$\s?\d|insured|background[- ]checked|ceiling tile|fixed price|not-to-exceed|three-hour|same person|every invoice/i);
 assert.match(page,/above five feet/);
 assert.match(page,/free walkthrough/i);
});
