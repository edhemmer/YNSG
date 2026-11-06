import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {hideExpiredOffers} from '../site/seasonal-services.js';
test('holiday offer shows through Dec 24 Central time and removes itself after',async()=>{
 const html=await readFile('site/pages/home.html','utf8');
 const at=iso=>{const doc=new JSDOM(html).window.document;hideExpiredOffers(doc,new Date(iso));return doc.querySelector('[data-show-until]');};
 assert.ok(at('2026-11-06T17:00:00Z'));
 assert.ok(at('2026-12-25T05:30:00Z'),'11:30pm Dec 24 in Chicago still shows');
 assert.equal(at('2026-12-25T06:30:00Z'),null);
});
test('snow page invites seasonal sign-up and the partner page is linked with the job guide',async()=>{
 const snow=await readFile('site/pages/snow-removal-dekalb-il.html','utf8');
 assert.match(snow,/Get on our winter list before the first storm/);
 const partner=new JSDOM(await readFile('site/pages/realtors-property-managers.html','utf8')).window.document;
 assert.ok(partner.querySelector('a[href="/pricing/#job-time-guide"]'));assert.match(partner.body.textContent,/No trip charges/);
});
