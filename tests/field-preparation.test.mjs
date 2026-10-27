import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('automatic preparation requires confirmed appointment before work',()=>{
 const brief=prepareFieldBrief(request,[],[],[]);
 assert.equal(brief.hasConfirmedVisit,false);
 assert.equal(brief.requiresOwnerDecision,true);
});
test('automatic preparation flags live work without treating it as completed',()=>{
 const confirmed={...request,appointments:[{status:'reserved'}]};
 const quote={id:'q1',request_id:request.id,status:'accepted',current_version:1,quote_versions:[{version:1,scope:'Mow',labor_cents:12000,duration_minutes:120}]};
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'working',revision:1};
 const brief=prepareFieldBrief(confirmed,[quote],[job],[]);
 assert.ok(brief.notes.some(n=>/Work is in progress/.test(n)));
 assert.equal(brief.requiresOwnerDecision,true);
});
test('field view displays one automated saved-state instruction without automatic sends',()=>{
 const source=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
 assert.match(source,/prepareFieldBrief\(request,quotes,jobs,invoices\)/);
 assert.match(source,/prepared\.notes\[0\]/);
 assert.doesNotMatch(source,/prepared\.notes\.map/);
});

test('field preparation identifies high-impact operational checks without authorizing action',()=>{
 const multi={...request,original_submission:{...request.original_submission,city:'',services:[{service:'Yard & garden',task:'Bulk or bagged mulch pickup, delivery & spreading'},{service:'Concrete pressure washing',task:'Concrete patio'},{service:'Home',task:'Assembly'},{service:'Yard',task:'Leaf cleanup'}]}};
 const before=JSON.stringify(multi);
 const brief=prepareFieldBrief(multi,[],[],[]);
 assert.ok(brief.notes.some(n=>n.includes('full service address')));
 assert.ok(brief.notes.some(n=>n.includes('4 jobs')));
 assert.ok(brief.notes.some(n=>n.includes('supplier')));
 assert.ok(brief.notes.some(n=>n.includes('outdoor water')));
 assert.equal(brief.hasConfirmedVisit,false);
 assert.equal(JSON.stringify(multi),before);
});
