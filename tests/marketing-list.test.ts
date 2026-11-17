import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketingCsv, csvCell, splitName, marketingExport, marketingCommand, marketingQuery, marketingSummary} from '../apps/web/lib/marketing-list.ts';

const contact = (patch = {}) => ({email: 'pat@example.invalid', name: 'Pat Q Synthetic', phone: '815-555-0100', street: '1 Test Lane', city: 'DeKalb', postalCode: '60115', basis: 'opt_in' as const, source: 'service-saturday-2026-12', since: '2026-11-20T15:00:00Z', token: 'a'.repeat(64), ...patch});

test('CSV opens cleanly in email tools: header, names split, one-click unsubscribe per row', () => {
  const csv = marketingCsv([contact()]);
  const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(header ?? '', '"Email","First Name","Last Name","Phone","Street","City","ZIP","Source","Subscribed On","Unsubscribe Link"');
  assert.match(row ?? '', /^"pat@example\.invalid","Pat","Q Synthetic","815-555-0100","1 Test Lane","DeKalb","60115","Signed up \(service-saturday-2026-12\)","2026-11-20","https:\/\/www\.yourneighborhoodserviceguy\.com\/unsubscribe\/\?t=a{64}"$/);
});

test('spreadsheet formula tricks in names are neutralized and quotes escaped', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('@SUM(1)'), `"'@SUM(1)"`);
  assert.equal(csvCell(null), '""');
  assert.deepEqual(splitName('  Cher '), ['Cher', '']);
  assert.deepEqual(splitName(null), ['', '']);
});

test('opted-out people can never be part of an export file', () => {
  assert.equal(marketingExport.safeParse([contact({basis: 'suppressed'})]).success, false);
  assert.equal(marketingExport.safeParse([contact({token: 'short'})]).success, false);
});

test('owner commands and queries are narrowly validated', () => {
  assert.equal(marketingCommand.safeParse({action: 'draw', organization: '20000000-0000-4000-8000-000000000001', campaign: 'service-saturday-2026-12'}).success, true);
  assert.equal(marketingCommand.safeParse({action: 'draw', organization: '20000000-0000-4000-8000-000000000001', campaign: 'Bad Name'}).success, false);
  assert.equal(marketingCommand.safeParse({action: 'delete', organization: '20000000-0000-4000-8000-000000000001'}).success, false);
  assert.equal(marketingQuery.safeParse({organization: 'x', view: 'export'}).success, false);
});

test('the Marketing screen shows the list only to owners and admins, and only owners change the feed', () => {
  const workspace = readFileSync('apps/web/app/workspace.tsx', 'utf8'), route = readFileSync('apps/web/app/api/marketing-list/route.ts', 'utf8');
  assert.match(workspace, /section === 'Marketing'&&\['owner','admin'\]\.includes\(role\|\|''\)&&<><MarketingList key=\{'marketing-list:'\+org\} organization=\{org\} owner=\{role==='owner'\}\/>/);
  assert.match(route, /if \(!sameOrigin\(request\)\) return fail\('FORBIDDEN'\);/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
});

test('summary accepts a list where some sources are still empty (a brand-new list)', () => {
  const base = {organization: '20000000-0000-4000-8000-000000000001', total: 0, subscribed: 0, optedOut: 0, campaigns: [], crmFeedStartsAt: null};
  assert.equal(marketingSummary.safeParse({...base, byBasis: {}}).success, true);
  assert.equal(marketingSummary.safeParse({...base, byBasis: {opt_in: 3}}).success, true);
  assert.equal(marketingSummary.safeParse({...base, byBasis: {nonsense: 3}}).success, false);
});
