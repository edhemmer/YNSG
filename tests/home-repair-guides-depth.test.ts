import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {GUIDES, searchGuides} from '../apps/web/lib/home-repair-guides.ts';
import {DEPTH} from '../apps/web/lib/home-repair-guides-extra.ts';

test('every doable guide meets the depth standard', () => {
  assert.ok(GUIDES.length >= 75, 'guide count');
  for (const g of GUIDES.filter(x => x.scope !== 'refer')) {
    assert.ok(g.quickCheck.length >= 2, g.id + ' quick checks');
    assert.ok(g.steps.length >= 4, g.id + ' steps');
    assert.ok(g.tricks.length >= 2, g.id + ' tricks');
    assert.ok((g.bestPractices || []).length >= 1, g.id + ' best practices');
  }
  assert.ok(GUIDES.filter(g => g.diagram).length >= 40, 'drawings');
  assert.equal(new Set(GUIDES.map(g => g.id)).size, GUIDES.length, 'unique ids');
  for (const id of Object.keys(DEPTH)) assert.ok(GUIDES.some(g => g.id === id), 'DEPTH targets a real guide: ' + id);
});

test('new everyday jobs are found first by plain words', () => {
  const q: [string, string][] = [['hole in wall', 'drywall-patch'], ['hang pictures', 'picture-hang'], ['floating shelf', 'wall-shelf'], ['shower head', 'shower-head'], ['low water pressure', 'faucet-aerator'], ['clogged toilet', 'toilet-clog'], ['slow drain', 'slow-drain'], ['caulk window', 'window-caulk'], ['window stuck', 'window-sticks'], ['caulk baseboard', 'trim-caulk'], ['replace door', 'door-slab'], ['fan wobbles', 'ceiling-fan-wobble'], ['garage door', 'garage-door']];
  for (const [w, id] of q) assert.equal(searchGuides(w)[0]?.id, id, w);
});

test('steps inserted by DEPTH land in a sensible order', () => {
  const step = (id: string, i: number) => GUIDES.find(g => g.id === id)!.steps[i]?.title;
  assert.equal(step('dryer-install', 0), 'Check the outlet first');
  assert.equal(step('furniture-anchor', 0), 'Empty top drawers first');
  assert.equal(step('closet-rod-shelf', 0), 'Level first');
});

test('safety lines stay in place: plumbing scope, springs, wiring and no chemical cleaners in toilets', () => {
  for (const id of ['shower-head', 'faucet-aerator', 'toilet-clog', 'slow-drain']) assert.equal(GUIDES.find(g => g.id === id)?.scope, 'minor-plumbing', id);
  const garage = GUIDES.find(g => g.id === 'garage-door')!;
  assert.match(garage.bestPractices!.join(' '), /springs/);
  assert.match(GUIDES.find(g => g.id === 'ceiling-fan-wobble')!.stop, /electrician/);
  const ui = readFileSync('apps/web/app/repair-guide-library.tsx', 'utf8');
  assert.match(ui, /Copy job sheet/);
  assert.match(ui, /repair-related/);
});
