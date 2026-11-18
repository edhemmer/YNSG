import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {hideExpiredOffers} from '../site/seasonal-services.js';
test('new-year offer shows through Jan 31 Central time and removes itself after',async()=>{
 const html=await readFile('site/pages/home.html','utf8');
 const at=iso=>{const doc=new JSDOM(html).window.document;hideExpiredOffers(doc,new Date(iso));return doc.querySelector('[data-show-until]');};
 assert.ok(at('2026-11-06T17:00:00Z'));
 assert.ok(at('2027-02-01T05:30:00Z'),'11:30pm Jan 31 in Chicago still shows');
 assert.equal(at('2027-02-01T06:30:00Z'),null);
});
test('snow page invites seasonal sign-up and the partner page links to estimates',async()=>{
 const snow=await readFile('site/pages/snow-removal-dekalb-il.html','utf8');
 assert.match(snow,/Get on our winter list before the first storm/);
 const partner=new JSDOM(await readFile('site/pages/realtors-property-managers.html','utf8')).window.document;
 assert.ok(partner.querySelector('a[href="/pricing/"]'));assert.match(partner.body.textContent,/visit minimum/);
});
