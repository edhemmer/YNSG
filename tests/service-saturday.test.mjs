import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkConfig, acceptingEntries, validateEntry, longDate, confirmationId} from '../lib/service-saturday.js';
import {serviceSaturday} from '../site/data/service-saturday.js';
import {MarketingFailure} from '../lib/marketing-db.js';
import entryHandler from '../api/service-saturday.js';
import unsubscribeHandler from '../api/unsubscribe.js';

const KEY = '11111111-2222-4333-8444-555555555555';
const config = {...serviceSaturday, open: true, startDate: '2026-11-17', entryDeadline: '2026-12-06', drawingDate: '2026-12-08', serviceDate: '2026-12-12'};
const beforeDeadline = new Date('2026-12-06T23:30:00-06:00'), afterDeadline = new Date('2026-12-07T00:05:00-06:00');
const entry = (patch = {}) => ({entryType: 'self', entrantName: 'Pat Synthetic', entrantEmail: 'Pat@Example.invalid', entrantPhone: '', entrantStreet: '1 Test Lane', entrantCity: 'DeKalb', entrantPostalCode: '60115', helpWith: 'Leaf and yard cleanup', story: 'Synthetic story for a test entry.', rulesAccepted: true, marketingConsent: true, requestKey: KEY, ...patch});
const req = (body, headers = {}) => ({method: 'POST', headers: {host: 'www.example.invalid', ...headers}, body, socket: {remoteAddress: '127.0.0.1'}});
function res() { const r = {headers: {}, statusCode: 0, body: null}; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = code => { r.statusCode = code; return r; }; r.json = body => { r.body = body; return r; }; return r; }
const env = enabled => ({CRM_ORGANIZATION_ID: '20000000-0000-4000-8000-000000000001', ...(enabled ? {} : {MARKETING_LIST_ENABLED: 'false'})});
const deps = (extra = {}) => { const sent = [], saved = []; return {sent, saved, d: {config, now: beforeDeadline, env: env(false), guard: async () => {}, mail: async m => { sent.push(m); return {accepted: true}; }, save: async (...a) => { saved.push(a); return {id: 'x', duplicate: false, unsubscribeToken: 'f'.repeat(64)}; }, ...extra}}; };

test('the committed settings are valid and the service day is a Saturday', () => {
  checkConfig(serviceSaturday);
  assert.match(longDate(serviceSaturday.serviceDate), /^Saturday, /);
  assert.throws(() => checkConfig({...config, serviceDate: '2026-12-11'}), /Saturday/);
  assert.throws(() => checkConfig({...config, approximateValue: 600}), /under 600/);
  assert.throws(() => checkConfig({...config, drawingDate: '2026-12-05'}), /deadline, then drawing/);
  assert.throws(() => checkConfig({...config, startDate: '2026-12-07'}), /start, deadline/);
});

test('entries close at midnight Central after the deadline, or whenever switched off', () => {
  assert.equal(acceptingEntries(config, beforeDeadline), true);
  assert.equal(acceptingEntries(config, afterDeadline), false);
  assert.equal(acceptingEntries({...config, open: false}, beforeDeadline), false);
  assert.equal(acceptingEntries(config, new Date('2026-11-16T12:00:00-06:00')), false, 'not before the published start date');
});

test('validation requires address, consent to rules and emails, and a nominee when nominating', () => {
  const ok = validateEntry(entry());
  assert.equal(ok.ok, true);
  assert.equal(ok.data.entrantEmail, 'pat@example.invalid');
  assert.equal(ok.data.workStreet, '1 Test Lane');
  for (const patch of [{entrantStreet: ''}, {entrantPostalCode: '6011'}, {rulesAccepted: false}, {marketingConsent: false}, {marketingConsent: 'true'}, {helpWith: 'Roof repair'}, {entrantEmail: 'nope'}, {entryType: 'nominate'}, {story: 'short'}])
    assert.equal(validateEntry(entry(patch)).ok, false, JSON.stringify(patch));
  const nominated = validateEntry(entry({entryType: 'nominate', nomineeName: 'Lee Synthetic', workStreet: '2 Other St', workCity: 'Sycamore', workPostalCode: '60178'}));
  assert.equal(nominated.ok, true);
  assert.equal(nominated.data.workCity, 'Sycamore');
});

test('closed or past-deadline Service Saturday accepts nothing', async () => {
  for (const extra of [{now: afterDeadline}, {config: {...config, open: false}}]) {
    const {sent, d} = deps(extra), r = res();
    await entryHandler(req(entry()), r, d);
    assert.equal(r.statusCode, 410); assert.equal(sent.length, 0);
  }
});

test('honeypot, cross-site posts and bad input never reach email or the database', async () => {
  const {sent, saved, d} = deps({env: env(true)});
  let r = res(); await entryHandler(req(entry({website: 'spam'})), r, d); assert.equal(r.statusCode, 200);
  r = res(); await entryHandler(req(entry(), {'sec-fetch-site': 'cross-site'}), r, d); assert.equal(r.statusCode, 403);
  r = res(); await entryHandler(req(entry(), {origin: 'https://evil.invalid'}), r, d); assert.equal(r.statusCode, 403);
  r = res(); await entryHandler(req(entry({marketingConsent: false})), r, d); assert.equal(r.statusCode, 400);
  r = res(); await entryHandler(req(entry({requestKey: 'nope'})), r, d); assert.equal(r.statusCode, 400);
  assert.equal(sent.length + saved.length, 0);
});

test('while the marketing list is paused, every entry is emailed to the owner', async () => {
  const {sent, saved, d} = deps({env: env(false)}), r = res();
  await entryHandler(req(entry()), r, d);
  assert.equal(r.statusCode, 200); assert.equal(saved.length, 0); assert.equal(sent.length, 2);
  assert.match(sent[0].body, /Not yet saved to the marketing list/);
  assert.match(sent[0].body, /pat@example\.invalid/);
  assert.equal(sent[0].replyTo, 'pat@example.invalid');
});

test('without a saved copy, a failed email is reported so the entrant can retry', async () => {
  const {d} = deps({env: env(false), mail: async () => { throw Error('down'); }}), r = res();
  await entryHandler(req(entry()), r, d);
  assert.equal(r.statusCode, 503);
});

test('with the list on, entries are saved; duplicates are friendly and send no second email', async () => {
  let {sent, saved, d} = deps({env: env(true)}), r = res();
  await entryHandler(req(entry()), r, d);
  assert.equal(r.statusCode, 200); assert.equal(saved.length, 1); assert.equal(saved[0][1], config.campaign);
  assert.doesNotMatch(sent[0].body, /Not yet saved/);
  ({sent, d} = deps({env: env(true), save: async () => ({id: 'x', duplicate: true})})); r = res();
  await entryHandler(req(entry()), r, d);
  assert.deepEqual(r.body, {ok: true, duplicate: true}); assert.equal(sent.length, 0);
  ({d} = deps({env: env(true), save: async () => { throw new MarketingFailure('RATE_LIMITED', 429); }})); r = res();
  await entryHandler(req(entry()), r, d); assert.equal(r.statusCode, 429);
  ({sent, d} = deps({env: env(true), mail: async () => { throw Error('down'); }})); r = res();
  await entryHandler(req(entry()), r, d); assert.equal(r.statusCode, 200, 'saved entry still succeeds if the owner alert fails');
});

test('unsubscribe needs only an email, answers the same way, and falls back to emailing the owner', async () => {
  const sent = [], calls = [];
  const d = enabled => ({env: env(enabled), guard: async () => {}, mail: async m => { sent.push(m); }, optOut: async (_r, args) => { calls.push(args); }});
  let r = res(); await unsubscribeHandler(req({email: 'Pat@Example.invalid'}), r, d(true));
  assert.equal(r.statusCode, 200); assert.deepEqual(calls[0], {email: 'pat@example.invalid', token: null}); assert.equal(sent.length, 0);
  const known = r.body;
  r = res(); await unsubscribeHandler(req({email: 'stranger@example.invalid'}), r, d(true));
  assert.deepEqual(r.body, known, 'same answer whether or not the address is on the list');
  r = res(); await unsubscribeHandler(req({token: 'a'.repeat(64)}), r, d(true));
  assert.deepEqual(calls[2], {email: null, token: 'a'.repeat(64)});
  r = res(); await unsubscribeHandler(req({email: 'pat@example.invalid'}), r, d(false));
  assert.equal(r.statusCode, 200); assert.match(sent[0].body, /Remove this address from all marketing emails: pat@example\.invalid/);
  r = res(); await unsubscribeHandler(req({email: 'not-an-email'}), r, d(true)); assert.equal(r.statusCode, 400);
});

test('published pages promise opt-out, honor the earlier notice and disclose the giveaway', () => {
  const privacy = readFileSync('site/pages/privacy.html', 'utf8'), terms = readFileSync('site/pages/terms.html', 'utf8'), rules = readFileSync('site/pages/service-saturday-rules.html', 'utf8'), form = readFileSync('site/pages/form.html', 'utf8');
  assert.match(privacy, /href="\/unsubscribe\/"/); assert.match(privacy, /Information sent to us before November 17, 2026 is not added to our marketing list/); assert.match(privacy, /never sell or rent our email list/);
  assert.match(terms, /href="\/unsubscribe\/"/); assert.doesNotMatch(terms, /ask separately before sending any marketing/);
  assert.match(form, /href="\/unsubscribe\/"/);
  for (const phrase of [/No purchase or payment of any kind/, /random drawing/, /Labor only/, /must be used in one visit/, /transferred to another person/, /has no cash value/, /298 Quinlan Ave/, /Void where prohibited/, /sign a short acceptance form/, /Approximate retail value/, /not sponsored, endorsed or administered by[^.]*Meta/, /Legal residents of Illinois who are 18 or older/]) assert.match(rules, phrase);
});

test('entrants get a branded confirmation with one-click opt-out and the mailing address; it never blocks the entry', async () => {
  let {sent, d} = deps({env: env(true)}), r = res();
  await entryHandler(req(entry()), r, d);
  assert.equal(r.statusCode, 200); assert.equal(sent.length, 2);
  const confirm = sent[1];
  assert.equal(confirm.to, 'pat@example.invalid');
  assert.equal(confirm.id, confirmationId(KEY), 'retries reuse one email id, so no double confirmations');
  assert.notEqual(confirm.id, sent[0].id);
  assert.match(confirm.html, /unsubscribe\/\?t=f{64}/);
  assert.match(confirm.body, /298 Quinlan Ave, DeKalb, IL 60115/);
  assert.match(confirm.html, /298 Quinlan Ave, DeKalb, IL 60115/);
  assert.match(confirm.body, /Saturday, December 12, 2026/);
  ({d} = deps({env: env(true), mail: async m => { if (m.to !== 'info@yourneighborhoodserviceguy.com') throw Error('down'); }})); r = res();
  await entryHandler(req(entry()), r, d); assert.equal(r.statusCode, 200, 'a failed confirmation still keeps the saved entry');
  assert.match(confirmationId(KEY), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
});
