import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/service-workflow.tsx','utf8');
test('new requests do not display a one-item step navigation or repeated explanatory caption',()=>{
 assert.match(source,/className="field-secondary-tools"/);
 assert.doesNotMatch(source,/First, choose and confirm an appointment time\. The rest of the job steps appear/);
 assert.doesNotMatch(source,/Only steps ready for this request are shown/);
});
test('unconfirmed decision and scheduling remain present with approved gating',()=>{
 assert.match(source,/!confirmedVisit\?'Confirm appointment'/);
 assert.match(source,/!confirmedVisit&&!\['declined','canceled'\]\.includes\(request\.status\)/);
 assert.match(source,/confirmedVisit&&<details className="workflow-supporting"/);
 assert.match(source,/allowedPhases\.includes\(p\.id\)/);
});
