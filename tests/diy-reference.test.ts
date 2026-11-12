import test from 'node:test';import assert from 'node:assert/strict';
import {diyGuides,diyCategories,searchDiy} from '../apps/web/lib/diy-reference.ts';
const banned=/handyman|no trip|trip charge|weed management|weeds? by hand|light hanging|insurance claim|referral reward|guaranteed/i;
test('DIY reference is broad, structured, safe and never implies an unlicensed service',()=>{
 assert.ok(diyGuides.length>=45);assert.equal(new Set(diyGuides.map(g=>g.id)).size,diyGuides.length);
 for(const c of diyCategories)assert.ok(diyGuides.some(g=>g.category===c),c);
 for(const g of diyGuides){assert.ok(g.steps.length>=4,g.id);assert.ok(g.tools.length>=1,g.id);assert.ok(g.stop.length>=1,g.id+' needs a stop rule');assert.doesNotMatch(JSON.stringify(g),banned,g.id);if(g.source)assert.match(g.source.url,/^https:\/\//,g.id);}
 for(const g of diyGuides.filter(g=>g.category==='Plumbing'&&!['find-shutoffs','find-leaks','clear-clog','winter-plumbing','sump-check','water-heater-care','faucet-aerator','toilet-seat','showerhead'].includes(g.id)))assert.equal(g.gate,'licensed',g.id);
 for(const g of diyGuides.filter(g=>g.category==='Electrical'&&['replace-outlet','light-fixture'].includes(g.id)))assert.equal(g.gate,'licensed',g.id);
});
test('electrical guides require proving power off and gas work is always referred',()=>{
 assert.match(diyGuides.find(g=>g.id==='power-off-test')!.steps.join(' '),/prove|Test/i);
 assert.match(diyGuides.find(g=>g.id==='replace-outlet')!.steps.join(' '),/dead/i);
 assert.match(JSON.stringify(diyGuides.find(g=>g.id==='dryer-install')),/gas/i);
 assert.match(JSON.stringify(diyGuides.find(g=>g.id==='lead-safe')),/1978/);
});
test('search finds guides in everyday words and filters by trade and fit',()=>{
 assert.ok(searchDiy('faucet').some(g=>g.id==='replace-faucet'));
 assert.ok(searchDiy('lint').some(g=>g.id==='dryer-vent'));
 assert.ok(searchDiy('',"Plumbing").every(g=>g.category==='Plumbing'));
 assert.ok(searchDiy('','All','licensed').every(g=>g.gate==='licensed'));
 assert.equal(searchDiy('zzzqqq').length,0);
});

import {diyIndex,suggestDiy,areasFor,topicsIn,guidesIn,azLetters,guidesStartingWith} from '../apps/web/lib/diy-index';
test('every DIY guide is classified into a room and topic',()=>{
 for(const g of diyGuides){const e=diyIndex[g.id];assert.ok(e,'unclassified: '+g.id);assert.ok(e.topic);assert.ok(e.rooms.length>0);}
 assert.equal(Object.keys(diyIndex).length,diyGuides.length);
});
test('browse by room and trade reaches every guide',()=>{
 for(const mode of ['room','trade'] as const){const seen=new Set<string>();for(const a of areasFor(mode))for(const t of topicsIn(mode,a))for(const g of t.guides)seen.add(g.id);assert.equal(seen.size,diyGuides.length,mode);}
 assert.ok(guidesIn('room','Bathroom').length>=15);
});
test('typeahead finds jobs from partial words',()=>{
 assert.equal(suggestDiy('cart')[0].id,'faucet-cartridge');
 assert.ok(suggestDiy('toi').some(g=>g.id==='toilet-flapper'));
 assert.ok(suggestDiy('latch').some(g=>g.id==='door-wont-latch'));
 assert.ok(suggestDiy('drip').some(g=>g.id==='faucet-compression'));
 assert.deepEqual(suggestDiy(''),[]);
 assert.equal(suggestDiy('zzzzqq').length,0);
});
test('A to Z index covers every guide',()=>{
 const n=azLetters().reduce((a,l)=>a+guidesStartingWith(l).length,0);assert.equal(n,diyGuides.length);
});
