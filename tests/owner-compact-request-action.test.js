import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../apps/web/app/'+p,import.meta.url),'utf8');
const inbox=read('request-inbox.tsx'),workflow=read('service-workflow.tsx');
test('Today compact request cards surface action without long redundant context',()=>{
 assert.match(inbox,/compact\?<details className="request-compact-details"/);
 assert.match(inbox,/<summary>Address & details<\/summary>/);
 assert.match(inbox,/!compact&&<span className="request-row-next"/);
 assert.match(inbox,/<RequestQuickActions request=\{r\}/);
});
test('work detail keeps call, directions, full address and canonical actions',()=>{
 assert.match(workflow,/className="field-job-header"/);
 assert.match(workflow,/submissionAddress\(request.original_submission\)/);
 assert.match(workflow,/href=\{'tel:'\+request.original_submission.phone\}/);
 assert.match(workflow,/navigationUrl\(submissionAddress\(request.original_submission\)\)/);
 assert.match(workflow,/fieldAction\(j,task.kind==='working'\?'pause':'resume'\)/);
});
