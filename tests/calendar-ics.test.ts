import test from 'node:test';import assert from 'node:assert/strict';import {calendarIcs} from '../apps/web/lib/calendar-ics.ts';
test('subscription uses stable identities, revisions, escaped names, UTC DST instants and canceled status',()=>{const text=calendarIcs({name:'Synthetic calendar',events:[{id:'one',revision:4,start:'2026-11-02T14:00:00Z',end:'2026-11-02T16:00:00Z',updatedAt:'2026-10-12T12:00:00Z',status:'canceled',customer:'Name;\nInjected, value',address:'100 Test St'}]});assert.match(text,/UID:one@ynsg-calendar/);assert.match(text,/SEQUENCE:4/);assert.match(text,/DTSTART:20261102T140000Z/);assert.match(text,/STATUS:CANCELLED/);assert.ok(text.includes('Name\\;\\nInjected\\, value'));assert.ok(!text.includes('\nInjected, value'));assert.ok(text.endsWith('END:VCALENDAR\r\n'));});
test('calendar subscription lines fold by UTF-8 bytes without splitting accented characters',()=>{const text=calendarIcs({name:'é'.repeat(100),events:[]});for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);assert.equal(text.replaceAll('\r\n ','' ).includes('é'.repeat(100)),true);});
import {visitInviteIcs} from '../apps/web/lib/calendar-ics.ts';
import {emailRaw} from '../apps/web/lib/google-core.ts';
test('customer visit invite is one stable, updatable event with a day-before reminder',()=>{
 const ics=visitInviteIcs({appointmentId:'11111111-2222-3333-4444-555555555555',revision:3,start:'2026-11-10T15:00:00Z',company:'Your Neighborhood Service Guy LLC',address:'100 Test St, DeKalb',phone:'815-680-1775',updatedAt:'2026-11-05T12:00:00Z'});
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const flat=ics.replaceAll('\r\n ','');
 assert.ok(flat.includes('UID:11111111-2222-3333-4444-555555555555@yourneighborhoodserviceguy.com'));
 assert.ok(flat.includes('SEQUENCE:3'));assert.ok(flat.includes('DTSTART:20261110T150000Z'));assert.ok(flat.includes('DTEND:20261110T170000Z'));
 assert.ok(flat.includes('LOCATION:100 Test St\\, DeKalb'));assert.ok(flat.includes('TRIGGER:-P1D'));assert.ok(flat.includes('815-680-1775'));
 assert.throws(()=>visitInviteIcs({appointmentId:'bad id\r\nX',revision:1,start:'2026-11-10T15:00:00Z',company:'x',address:null}));
 assert.throws(()=>visitInviteIcs({appointmentId:'11111111-2222',revision:1,start:'nope',company:'x',address:null}));
});
test('confirmation mail carries the invite as a calendar attachment and rejects anything else',()=>{
 const ics=visitInviteIcs({appointmentId:'11111111-2222-3333-4444-555555555555',revision:1,start:'2026-11-10T15:00:00Z',company:'Co',address:null,updatedAt:'2026-11-05T12:00:00Z'});
 const raw=Buffer.from(emailRaw('from@example.com','to@example.com','Subject','Body','ynsg-abc',{html:'<p>Hi</p>',calendar:ics}),'base64url').toString();
 assert.ok(raw.includes('multipart/mixed'));assert.ok(raw.includes('text/calendar; charset=UTF-8; method=PUBLISH; name="visit.ics"'));assert.ok(raw.includes('multipart/alternative'));
 assert.throws(()=>emailRaw('from@example.com','to@example.com','Subject','Body','ynsg-abc',{calendar:'not a calendar'}));
});
