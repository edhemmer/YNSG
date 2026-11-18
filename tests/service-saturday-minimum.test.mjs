import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceSaturday} from '../site/data/service-saturday.js';
import {checkConfig} from '../lib/service-saturday.js';

test('Service Saturday draws in January 2027 and needs 35 entries first', () => {
  checkConfig(serviceSaturday);
  assert.equal(serviceSaturday.minimumEntries, 35);
  assert.equal(serviceSaturday.drawingDate, '2027-01-19');
  assert.equal(serviceSaturday.serviceDate, '2027-01-23');
  assert.equal(serviceSaturday.campaign, 'service-saturday-2027-01', 'campaign named for the January 2027 drawing');
  assert.throws(() => checkConfig({...serviceSaturday, minimumEntries: 0}));
  assert.throws(() => checkConfig({...serviceSaturday, finalEntryDate: '2026-12-01'}));
  const rules = readFileSync('site/pages/service-saturday-rules.html', 'utf8');
  assert.match(rules, /Minimum number of entries/);
  assert.match(rules, /two-week steps/);
  assert.match(readFileSync('site/pages/service-saturday.html', 'utf8'), /at least \{\{SS_MIN_ENTRIES\}\} entries/);
});

test('the owner app and API refuse a first drawing below the minimum', () => {
  const ui = readFileSync('apps/web/app/marketing-list.tsx', 'utf8');
  assert.match(ui, /data\.entries\.length < minimumEntries\(campaign\)/);
  const route = readFileSync('apps/web/app/api/marketing-list/route.ts', 'utf8');
  assert.match(route, /BELOW_MINIMUM/);
  assert.match(route, /current\.entries\.length < serviceSaturday\.minimumEntries/);
});
