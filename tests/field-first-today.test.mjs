import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('apps/web/app/command-center.tsx','utf8');
test('Today contains one operational queue without marketing, metrics or stacked assistants',()=>{
 assert.match(s,/aria-label="Field work queue"/);assert.doesNotMatch(s,/MarketingDrafts|BusinessBrief|metric-grid|Business overview/);
 assert.match(s,/const activeWork=shownWork\.find\(j=>j\.status==='working'\)\|\|shownWork\.find\(j=>j\.status==='paused'\)/);assert.match(s,/activeRequestIds\.has\(c.requestId\)/);
});
test('field queue retains direct job opening, routes and invoices',()=>{
 assert.match(s,/onOpen\(next.request\)/);assert.match(s,/onNavigate\('Today'\)/);assert.match(s,/onNavigate\('Money'\)/);
});

test('Today offers direct navigation and does not imply that opening a paused job resumes a timer',()=>{
 assert.match(s,/navigationUrl\(next\.address\)/);
 assert.match(s,/Review paused job/);
 assert.match(s,/aria-label=\{'Directions to '\+next\.name\}/);
});

test('Today puts field visits ahead of invoice-only work without hiding invoice backlog',()=>{
 assert.match(s,/const next=activeWork\|\|\(!todayStops\.length&&!pending\.length\?shownWork\[0\]:null\)/);
 assert.match(s,/const remainingWork=shownWork\.filter/);
 assert.match(s,/remainingWork\.map\(j=>/);
 assert.match(s,/remainingWork\.length>0/);
});

test('Today presents owner decisions as an explicit queue and never mistakes loaded subset for an empty business',()=>{
 assert.match(s,/Requests needing a decision/);
 assert.match(s,/pending\.length/);
 assert.match(s,/data\.requests\?\.hasMore/);
 assert.match(s,/No outstanding decisions in the loaded queue/);
});

test('Today displays new customer decisions before secondary work backlog',()=>{
 const decisions=s.indexOf('aria-label="Requests awaiting a decision"');
 const later=s.indexOf('aria-label="Remaining work"');
 assert.ok(decisions>0&&later>decisions,'Owner review must be visible above expanded backlog');
});

test('Today keeps field actions available during periodic background updates',()=>{
 assert.match(s,/let live=true,inFlight=false,firstRead=true/);
 assert.match(s,/if\(firstRead\)setRefreshing\(true\)/);
 assert.match(s,/setRefreshing\(false\);firstRead=false/);
 assert.match(s,/aria-busy=\{refreshing\}/);
});

test('Today never hides an explicit review decision merely because a job or reserved visit is linked',()=>{
 assert.match(s,/const pending=\(data\?\.requests\?\.requests\|\|\[\]\)\.filter\(r=>!\['declined','canceled'\]\.includes\(r\.status\)\)/);
 assert.doesNotMatch(s,/!used\.has\(r\.id\)/);
 assert.doesNotMatch(s,/!r\.appointments\.some\(a=>a\.status==='reserved'\)/);
});

test('Today preserves separate active and completed jobs tied to the same request',()=>{
 assert.match(s,/const shownWork=work\.filter\(\(j,i\)=>work\.findIndex\(other=>other\.job===j\.job\)===i\)/);
 assert.doesNotMatch(s,/work\.findIndex\(other=>other\.request===j\.request\)/);
 assert.match(s,/foundWork\.map\(j=><button[^\n]+key=\{j\.job\}/);
 assert.match(s,/remainingWork\.map\(j=><button[^\n]+key=\{j\.job\}/);
});

test('completed uninvoiced jobs do not hide future distinct visits',()=>{
 assert.match(s,/work\.filter\(j=>j\.status==='working'\|\|j\.status==='paused'\)/);
 assert.match(s,/seenVisits\.has\(c\.id\)/);
 assert.doesNotMatch(s,/new Set\(work\.map\(j=>j\.request\)\)/);
});

test('Today selects the chronological next arrival despite unordered route responses',()=>{
 assert.match(s,/const stops=\[\.\.\.\(data\?\.day\?\.calls\|\|\[\]\)\]\.sort\(\(a,b\)=>Date\.parse\(a\.arrivalAt\)-Date\.parse\(b\.arrivalAt\)\)/);
 assert.match(s,/nextStop=!next\?todayStops\[0\]:null/);
});

test('Today makes a pending customer decision the main action when there is no job or visit',()=>{
 assert.match(s,/pending\.length\?<section className="field-current card is-clickable" aria-label="Next request decision"/);
 assert.match(s,/onOpen\(pending\[0\]!\.id\)/);
 assert.match(s,/Nothing on today’s list: no visits today, unfinished work, or requests needing a decision/);
});

test('an open customer decision outranks invoice-only work when no active visit is underway',()=>{
 assert.match(s,/const next=activeWork\|\|\(!todayStops\.length&&!pending\.length\?shownWork\[0\]:null\)/);
 assert.match(s,/const remainingWork=shownWork\.filter/);
 assert.match(s,/pending\.length\?<section className="field-current card is-clickable" aria-label="Next request decision"/);
});

test('Today keeps the rest of today\'s visits in the secondary queue when active work owns the primary card',()=>{
 assert.match(s,/todayStops\.filter\(c=>c\.id!==nextStop\?\.id\)\.map\(c=>/);
 assert.match(s,/todayStops\.some\(c=>c\.id!==nextStop\?\.id\)/);
 assert.doesNotMatch(s,/stops\.slice\(nextStop\?1:0\)/);
});

test('running work outranks paused work in the primary Today card',()=>{
 assert.match(s,/const activeWork=shownWork\.find\(j=>j\.status==='working'\)\|\|shownWork\.find\(j=>j\.status==='paused'\)/);
});

test('field search clearly distinguishes jobs, appointments and independent decisions for the same customer',()=>{
 assert.match(s,/const matchingKinds=\[/);
 assert.match(s,/matchingKinds\?' · '\+matchingKinds/);
 assert.match(s,/Invoice needed · Job/);
 assert.match(s,/Appointment · \{time\(c\.arrivalAt\)\}/);
 assert.match(s,/Decision needed/);
});

test('Today lists only today\'s visits; later days stay in Schedule',()=>{
 assert.match(s,/const todayStops=stops\.filter\(c=>dayKey\(new Date\(c\.arrivalAt\)\)===dayKey\(new Date\(\)\)\)/);
 assert.match(s,/const visitsToday=todayStops\.length/);
 assert.doesNotMatch(s,/Other work & upcoming stops/);
});

test('Today has Today, Tomorrow and This week tabs that never mix days',()=>{
 assert.match(s,/role="tablist" aria-label="Which days to show"/);
 assert.match(s,/\['today','Today',visitsToday\],\['tomorrow','Tomorrow',tomorrowStops\.length\],\['week','This week',weekStops\.length\]/);
 assert.match(s,/const tomorrowStops=stops\.filter\(c=>inRange\(c,tomorrowKey,tomorrowKey\)\)/);
 assert.match(s,/\{range!=='today'\?<section id="range-panel"/);
});
