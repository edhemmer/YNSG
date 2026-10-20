import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileWorkflow,availableMobilePhases} from '../apps/web/lib/mobile-workflow.ts';
import {mobileNavigation,ownerStart} from '../apps/mobile/src/navigation-policy.ts';
import type {InboxRequest,LinkedJob,LinkedQuote,LinkedInvoice} from '../apps/web/lib/request-inbox.ts';
const request:InboxRequest={id:'r',status:'quoted',revision:1,created_at:'2030-10-16T12:00:00Z',original_submission:{name:'Synthetic',email:'test@example.invalid',phone:'5550100',street:'Test',city:'DeKalb'},appointments:[]};
const quote:LinkedQuote={id:'q',request_id:'r',status:'accepted',current_version:1,quote_versions:[{version:1,scope:'Agreed assembly',labor_cents:12000,duration_minutes:120}]};
const job:LinkedJob={id:'j',quote_id:'q',status:'completed',revision:4};
const invoice:LinkedInvoice={id:'i',job_id:'j',number:1,total_cents:12000,payments:[{cents:12000}]};
test('mobile closeout requires every non-canceled job invoiced and every issued balance paid',()=>{
 assert.equal(mobileWorkflow(request,[quote],[job],[invoice]).settled,true);
 assert.equal(mobileWorkflow(request,[quote],[job],[{...invoice,payments:[{cents:5000}]}]).settled,false);
 const additional={...job,id:'j2',status:'completed'};const p=mobileWorkflow(request,[quote],[job,additional],[invoice]);assert.equal(p.settled,false);assert.equal(p.phase,'invoice');assert.equal(p.next.step,5);
 assert.equal(mobileWorkflow(request,[quote],[job,{...additional,status:'canceled'}],[invoice]).settled,true);
});
test('native navigation never embeds foreign or non-HTTPS pages in the credential-bearing workspace',()=>{
 assert.equal(mobileNavigation(ownerStart),'internal');assert.equal(mobileNavigation('https://yourneighborhoodserviceguy.app/invoice?id=test'),'internal');
 for(const url of ['https://yourneighborhoodserviceguy.app.attacker.invalid/owner','https://attacker.invalid/','tel:+17706302094','mailto:owner@example.invalid'])assert.equal(mobileNavigation(url),'external');
 for(const url of ['javascript:alert(1)','file:///etc/passwd','http://yourneighborhoodserviceguy.app/owner','https://user:secret@yourneighborhoodserviceguy.app/owner','mailto:owner@example.invalid%0d%0aBcc:other@example.invalid'])assert.equal(mobileNavigation(url),'blocked');
});

test('owner request progression unlocks actions only after actual saved milestones',()=>{
 assert.deepEqual(availableMobilePhases(request,[],[]),['visit']);
 const withProposal={...request,appointments:[{id:'p',status:'proposal',start_at:'2030-10-21T12:00:00Z',end_at:'2030-10-21T14:00:00Z'}]};
 assert.deepEqual(availableMobilePhases(withProposal,[],[]),['visit']);
 const withConfirmed={...request,appointments:[{id:'p',status:'reserved',start_at:'2030-10-21T12:00:00Z',end_at:'2030-10-21T14:00:00Z'}]};
 assert.deepEqual(availableMobilePhases(withConfirmed,[],[]),['visit','work']);
 assert.deepEqual(availableMobilePhases(withConfirmed,[job],[]),['visit','work','invoice']);
 assert.deepEqual(availableMobilePhases(withConfirmed,[job],[invoice]),['visit','work','invoice','closeout']);
});
