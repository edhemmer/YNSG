import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/web/app/style.css',import.meta.url),'utf8');
test('field cockpit displays actionable next step, with admin information collapsed',()=>{
 assert.match(source,/field-cockpit-next/);
 assert.match(source,/onClick=\{openSchedule\}/);
 assert.match(source,/fieldAction\(j,'start'\)/);
 assert.match(source,/fieldAction\(j,'pause'\)/);
 assert.match(source,/fieldAction\(j,'resume'\)/);
 assert.match(source,/<summary>Job preparation & follow-up drafts<\/summary>/);
 assert.match(source,/<summary>Appointment details<\/summary>/);
 assert.match(css,/\.field-cockpit-next/);
 assert.match(source,/function QuickQuoteAgreement/);
 assert.match(source,/Record customer approval/);
});
