import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFieldBrief} from '../apps/web/lib/field-preparation.ts';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
const request={id:'10000000-0000-4000-8000-000000000001',status:'submitted',revision:1,original_submission:{name:'Test customer',phone:'5550100',street:'Test',city:'DeKalb',services:[{service:'Lawn',task:'Mow'},{service:'Yard',task:'Leaf cleanup'}],description:'Use side gate'},appointments:[]};
test('field preparation derives action and instructions without writing or fabricating approval',()=>{
 const before=JSON.stringify(request);
 const brief=prepareFieldBrief(request,[],[],[]);
 assert.deepEqual(brief.services,['Mow','Leaf cleanup']);
 assert.ok(brief.notes.some(s=>s.includes('customer instructions')));
 assert.equal(brief.hasConfirmedVisit,false);
 assert.equal(JSON.stringify(request),before);
});
test('current owner action remains primary without repeating an agent explanation',()=>{
 assert.match(source,/className="workflow-next" role="status"/);
 assert.match(source,/data-field-cockpit-next/);
 assert.doesNotMatch(source,/Prepared next decision/);
 assert.doesNotMatch(source,/className="workflow-field-brief/);
});
