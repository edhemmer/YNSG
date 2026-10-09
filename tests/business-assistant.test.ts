import test from 'node:test';
import assert from 'node:assert/strict';
import {businessBrief,marketingDraft} from '../apps/web/lib/business-assistant.ts';
import type {BusinessSnapshot} from '../apps/web/lib/business-snapshot.ts';
import type {CompanySettings} from '../packages/contracts/index.ts';
const snapshot=(counts:Partial<BusinessSnapshot['counts']>={},balance=0):BusinessSnapshot=>({checkedAt:'2026-10-09T12:00:00Z',from:'2026-10-01',to:'2026-10-09',timezone:'America/Chicago',counts:{customers:0,requestsInPeriod:0,requestsToReview:0,upcomingVisits:0,proposals:0,working:0,paused:0,completed:0,quotes:0,messagesToCheck:0,rescheduleRequests:0,...counts},finance:{cashReceivedCents:0,expenseCents:0,cashAfterExpensesCents:0,issuedInvoicesCents:0,outstandingAsOfEndCents:balance,paymentCount:0,expenseCount:0},email:{enabled:false,automaticSending:false}});
test('delivery exceptions and customer changes come first; routes open the day route',()=>{
 const tasks=businessBrief(snapshot({deliveryExceptions:1,rescheduleRequests:2,requestsToReview:9,proposals:3,upcomingVisits:4,working:1},12000));
 assert.deepEqual(tasks.map(t=>t.id),['exceptions','changes','requests','proposals','routes','work','payments']);
 assert.match(tasks[0]!.title,/1 automation exception$/);assert.match(tasks[2]!.title,/9 requests/);
 assert.equal(tasks.find(t=>t.id==='routes')!.section,'Today');
 assert.match(tasks.find(t=>t.id==='payments')!.title,/\$120\.00/);
});
test('normal pending automation is not presented as a failure; completed jobs and sent quotes do not imply unpaid or overdue',()=>{
 const tasks=businessBrief(snapshot({messagesToCheck:1,completed:40,quotes:1}));
 assert.deepEqual(tasks.map(t=>t.id),['quotes','automation']);assert.match(tasks[0]!.detail,/does not prove it is overdue/);
 assert.doesNotMatch(tasks[1]!.title,/failed|exception/);assert.deepEqual(businessBrief(snapshot()),[]);
});
const settings={displayName:'Your Neighborhood Service Guy',cities:['DeKalb','Sycamore','Cortland'],hourly:{standardCents:6000,communityCents:4500,minimumMinutes:120}} as CompanySettings;
const service={name:'Furniture assembly',scope:'Assembly of freestanding, customer-supplied furniture.',exclusions:'No electrical, plumbing or structural work.',compliance:'approved',pricing_mode:'hourly'};
test('marketing uses published prices, minimum and exclusions; other companies keep their own facts',()=>{
 const draft=marketingDraft(settings,service,'post');assert.match(draft,/\$60\/hour/);assert.match(draft,/2-hour minimum/);assert.match(draft,/No electrical, plumbing or structural work/);assert.match(draft,/Request service appt\./);assert.doesNotMatch(draft,/request help|same.day|available tomorrow|guaranteed|Edward/i);
 const franchise=marketingDraft({...settings,displayName:'Another Neighbor Company',cities:['Another Town'],hourly:{...settings.hourly,standardCents:7500}},{...service,pricing_mode:'quote'},'flyer');assert.match(franchise,/Another Neighbor Company/);assert.match(franchise,/Another Town/);assert.doesNotMatch(franchise,/DeKalb|\$60|Ed Hemmer/);assert.match(franchise,/price confirmed/);
});
test('unapproved services cannot become marketing offers',()=>{
 for(const compliance of ['held'])assert.throws(()=>marketingDraft(settings,{...service,compliance},'post'));
 assert.throws(()=>marketingDraft(settings,{...service,exclusions:''},'post'));
});

test('published review services can produce conditional drafts without globally approving work',()=>{assert.match(marketingDraft(settings,{...service,compliance:'review'},'post'),/reviewed individually before work is accepted/);});
