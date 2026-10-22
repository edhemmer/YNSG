import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFieldBrief} from '../apps/web/lib/field-preparation.ts';
const request={id:'10000000-0000-4000-8000-000000000001',status:'submitted',revision:1,original_submission:{name:'Test customer',phone:'5550100',street:'Test',city:'DeKalb',services:[{service:'Lawn',task:'Mow'},{service:'Yard',task:'Leaf cleanup'}],description:'Use side gate'},appointments:[]};
test('field preparation derives action and instructions without writing or fabricating approval',()=>{
 const before=JSON.stringify(request);
 const brief=prepareFieldBrief(request,[],[],[]);
 assert.deepEqual(brief.services,['Mow','Leaf cleanup']);
 assert.ok(brief.notes.some(s=>s.includes('customer instructions')));
 assert.equal(brief.hasConfirmedVisit,false);
 assert.equal(JSON.stringify(request),before);
});
