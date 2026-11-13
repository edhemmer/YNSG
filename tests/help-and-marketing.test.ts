import test from 'node:test';import assert from 'node:assert/strict';
import {helpArticles,helpCategories,searchHelp} from '../apps/web/lib/help-articles.ts';
import {monthPlans,evergreenPosts,monthPlanFor,channels,reviewScripts} from '../apps/web/lib/marketing-playbook.ts';
import {emailTemplates} from '../apps/web/lib/email-templates.ts';
const banned=/handyman|no trip|trip charge|weed management|weeds? by hand|light hanging|insurance claim|referral reward|guaranteed|limited availability|slots are filling/i;
test('help library is complete, unique, in plain words and follows the wording rules',()=>{
 assert.ok(helpArticles.length>=35);assert.equal(new Set(helpArticles.map(a=>a.id)).size,helpArticles.length);
 for(const c of helpCategories)assert.ok(helpArticles.some(a=>a.category===c),c);
 for(const a of helpArticles){assert.ok(a.steps.length>=2,a.id);assert.ok(a.keywords.length>=3,a.id);assert.doesNotMatch(JSON.stringify(a),banned,a.id);}
});
test('help search finds articles by everyday words',()=>{
 assert.equal(searchHelp('cash')[0]?.id,'record-cash');
 assert.ok(searchHelp('spam').some(a=>a.id==='email-spam'));
 assert.ok(searchHelp('review').some(a=>a.id==='get-reviews'));
 assert.equal(searchHelp('').length,helpArticles.length);assert.equal(searchHelp('zzzzqq').length,0);
});
test('marketing playbook covers every month, references real templates and obeys the rules',()=>{
 assert.deepEqual(monthPlans.map(m=>m.month),[1,2,3,4,5,6,7,8,9,10,11,12]);
 const ids=new Set(emailTemplates.map(t=>t.id));
 for(const m of monthPlans){assert.ok(m.posts.length>=2,m.name);for(const e of m.emails)assert.ok(ids.has(e),m.name+' '+e);}
 assert.doesNotMatch(JSON.stringify({monthPlans,evergreenPosts,channels,reviewScripts}),banned);
 assert.equal(monthPlanFor(new Date('2026-11-12T18:00:00Z')).name,'November');
 assert.ok(monthPlans[10]!.emails.includes('veterans-day'));
});
