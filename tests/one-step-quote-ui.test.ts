import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerCommandSchema} from '../apps/web/lib/owner-command-contract.ts';
const form=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../apps/web/app/api/commands/route.ts',import.meta.url),'utf8');
test('normal agreed quote saves and prepares the job without a separate customer approval screen',()=>{
 assert.match(form,/Save agreed quote &amp; prepare job/);
 assert.match(form,/Save quote only/);
 assert.match(form,/Prepare agreed job/);
 for(const old of ['<CustomerAgreement','Record phone agreement','Record in-person agreement','Record text or email agreement'])
  assert.equal(form.includes(old),false,old);
 assert.match(api,/save_agreed_quote_and_prepare_job/);
 assert.match(api,/prepare_agreed_quote_job/);
});
test('owner command supports explicit agreed quote and separate quote-only paths',()=>{
 const base={organizationId:'20000000-0000-4000-8000-000000000001',key:'test-unique-request-key-00000001',id:'30000000-0000-4000-8000-000000000001',revision:2,scope:'Synthetic agreed lawn cleanup',minutes:90,crewSize:1,community:false,eligibilityReviewed:false,customerId:null};
 assert.equal(ownerCommandSchema.safeParse({...base,command:'SaveAgreedQuote'}).success,true);
 assert.equal(ownerCommandSchema.safeParse({...base,command:'PublishQuote'}).success,true);
 assert.equal(ownerCommandSchema.safeParse({organizationId:base.organizationId,key:base.key,command:'PrepareAgreedQuote',id:base.id,version:1}).success,true);
 assert.equal(ownerCommandSchema.safeParse({organizationId:base.organizationId,key:base.key,command:'PrepareAgreedQuote',id:base.id,version:0}).success,false);
});
