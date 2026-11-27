import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDES, CATEGORIES, searchGuides} from '../apps/web/lib/home-repair-guides.ts';

test('the owner\'s own words find the right repair guide first',()=>{
 const expect:[string,string][]=[['door sticking','door-sticking'],['doors that aren\'t closing correctly','door-wont-latch'],['locks that aren\'t working','deadbolt-sticks'],['kitchen cabinet door repair','cabinet-door-hinge'],['drawer slider repair','drawer-slides'],['how to fix a toilet','running-toilet'],['dripping faucet','dripping-faucet'],['outdoor faucet','outdoor-faucet'],['floor trim installation','trim-shoe-molding'],['flooring threshold repair','floor-transition'],['tile grout repair','grout-repair']];
 for(const [q,id] of expect)assert.equal(searchGuides(q)[0]?.id,id,q);
 assert.equal(searchGuides('zzzz').length,0);
});
test('every guide is complete: quick check, steps, trade tricks, tools, a stop-and-refer line',()=>{
 const ids=new Set<string>();
 for(const g of GUIDES){
  assert.ok(!ids.has(g.id),g.id);ids.add(g.id);assert.ok(CATEGORIES[g.category],g.id);
  assert.ok(g.quickCheck.length>=1&&g.steps.length>=(g.scope==='refer'?2:3)&&g.tricks.length>=1&&g.tools.length>=1,g.id);
  assert.ok(g.stop.length>20,g.id);
  if(g.source)assert.match(g.source.url,/^https:\/\//,g.id);
 }
});
test('plumbing guides stay inside Illinois minor-repair limits and say where the line is',()=>{
 for(const g of GUIDES.filter(g=>g.category==='plumbing')){assert.equal(g.scope,'minor-plumbing',g.id);assert.match(g.stop,/licensed-plumber work in Illinois/,g.id);}
 const ui=readFileSync('apps/web/app/repair-guide-library.tsx','utf8');assert.match(ui,/PLUMBING_SCOPE_NOTE/);assert.match(ui,/PLUMBING_LAW_URL/);
});
test('the guide covers home, appliance, yard and seasonal work with best practices and dig safety',()=>{
 const q:[string,string][]=[['installing a dryer','dryer-install'],['install washer','washer-install'],['mount tv','tv-mount'],['mulch','mulch-beds'],['prune bushes','shrub-pruning'],['gate sagging','gate-sag'],['ice melt','snow-ice'],['wheelchair brakes','wheelchair-adjust'],['dead outlet','gfci-breaker'],['garbage disposal','garbage-disposal'],['mailbox','mailbox-post']];
 for(const [w,id] of q)assert.equal(searchGuides(w)[0]?.id,id,w);
 assert.ok(GUIDES.length>=60);
 assert.ok(GUIDES.filter(g=>g.bestPractices?.length).length>=40);
 for(const g of GUIDES.filter(g=>['plant-shrub','mailbox-post','fence-repair'].includes(g.id)))assert.equal(g.dig,true,g.id);
 for(const id of ['gas-dryer','light-fixture-refer'])assert.equal(GUIDES.find(g=>g.id===id)?.scope,'refer');
 const ui=readFileSync('apps/web/app/repair-guide-library.tsx','utf8');assert.match(ui,/JULIE_NOTE/);assert.match(ui,/Best practices/);
});
test('every referenced drawing exists and the guide never uses "home safety" wording',()=>{
 const drawings=readFileSync('apps/web/app/repair-diagrams.tsx','utf8');
 for(const g of GUIDES)if(g.diagram)assert.ok(drawings.includes("'"+g.diagram+"': {"),g.diagram);
 assert.doesNotMatch(JSON.stringify(GUIDES),/home safety/i);
 assert.doesNotMatch(JSON.stringify(GUIDES),/gutter/i);
});
test('every quick-pick chip opens a real lesson, the one it names',async()=>{
 const {guideForChip}=await import('../apps/web/lib/home-repair-guides.ts');
 const src=readFileSync(new URL('../apps/web/app/repair-guide-library.tsx',import.meta.url),'utf8');
 const chips=JSON.parse((src.match(/const SUGGESTIONS = (\[[^\]]+\])/)?.[1] ?? "[]").replace(/'/g,'"')) as string[];
 assert.ok(chips.length>=10,"found the chip list");
 for(const c of chips)assert.ok(guideForChip(c),c);
 assert.equal(guideForChip('dryer vent')?.id,GUIDES.find(g=>/^Dryer vent/.test(g.title))?.id);
 assert.equal(guideForChip('running toilet')?.id,'running-toilet');
 assert.match(src,/guideForChip\(s\); if \(g\) open\(g\.id\)/);
});
