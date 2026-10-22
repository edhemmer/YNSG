import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('apps/web/app/service-workflow.tsx','utf8');
test('field workflow emphasizes next action and folds optional administration',()=>{
 assert.match(s,/<details className="workflow-supporting"><summary>Customer files and contacts<\/summary>/);
 assert.match(s,/<details className="workflow-supporting"><summary>Extra work or unexpected conditions<\/summary>/);
 assert.doesNotMatch(s,/initialExpanded suggestedWork=/);
 assert.match(s,/className="field-command-primary"/);
});
test('confirmation, decline, deliberate invoicing, payments and notes stay connected',()=>{
 assert.match(s,/Confirm appointment/);
 assert.match(s,/>Decline request<\/button>/);
 assert.match(s,/request\.original_submission\.description/);
 assert.match(s,/InvoiceDraft mobile/);
 assert.match(s,/InvoicePayments guided/);
 assert.match(s,/phase==='closeout'&&invoices\.map/);
});

test('field command presents a real canonical timer and scheduling action above optional tools',()=>{
 assert.match(s,/className="field-command-primary"/);
 assert.match(s,/onClick=\{executeFieldAction\}/);
 assert.match(s,/fieldAction\(readyJob,readyJob\.status==='working'\?'pause':readyJob\.status==='paused'\?'resume':'start'\)/);
 assert.match(s,/if\(!confirmedVisit\)\{focusPhase\('visit'\);openSchedule\(\);return;\}/);
 assert.match(s,/className="field-secondary-tools"/);
 assert.doesNotMatch(s,/Prepared next decision|Prepared customer follow-up|Prepared for you/);
});
