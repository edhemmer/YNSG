import test from 'node:test';
import assert from 'node:assert/strict';
import {visitReportDraft,visitReportReady,workLines,visitDateLabel} from '../apps/web/lib/visit-report.ts';
import {brandedEmailHtml} from '../apps/web/lib/email-templates.ts';
const base={customerName:'Pat Morgan',visitDate:'2026-11-10',workDone:'- Assembled the dresser\n• Hung 4 pictures\n\n  Replaced front doorknob  ',noticed:'',photosAttached:false,nextVisit:'',reviewLink:'https://g.page/r/CWxW2KabD1UWECE/review'};
test('work lines are cleaned of bullets and blanks',()=>{assert.deepEqual(workLines(base.workDone),['Assembled the dresser','Hung 4 pictures','Replaced front doorknob']);});
test('dates must be real calendar dates',()=>{assert.equal(visitDateLabel('2026-11-10'),'Tuesday, November 10');assert.equal(visitDateLabel('2026-02-30'),'');assert.equal(visitDateLabel('soon'),'');});
test('report reads warmly, keeps the 7-day promise, and only adds optional sections when filled',()=>{
 const d=visitReportDraft(base);
 assert.equal(d.subject,'Your visit report for Tuesday, November 10');
 assert.match(d.body,/^Hi Pat,/);assert.match(d.body,/• Assembled the dresser\n• Hung 4 pictures\n• Replaced front doorknob/);
 assert.match(d.body,/within 7 days/);assert.doesNotMatch(d.body,/What we noticed|photos are attached|Suggested next visit/);
 assert.equal(d.cta,'Share a quick Google review');assert.equal(d.url,'https://g.page/r/CWxW2KabD1UWECE/review');
 const full=visitReportDraft({...base,noticed:'The back gate latch is loose.',photosAttached:true,nextVisit:'Spring cleanup in April'});
 assert.match(full.body,/What we noticed:\nThe back gate latch is loose\./);assert.match(full.body,/Before-and-after photos are attached/);assert.match(full.body,/Suggested next visit:\nSpring cleanup in April/);
});
test('unsafe review links fall back to the request page and HTML is escaped',()=>{
 const d=visitReportDraft({...base,reviewLink:'javascript:alert(1)',workDone:'<img src=x onerror=alert(1)>'});
 assert.equal(d.cta,'Plan your next visit');assert.match(d.url,/^https:\/\/www\.yourneighborhoodserviceguy\.com\/request\//);
 assert.doesNotMatch(brandedEmailHtml(d),/<img src=x/);
});
test('a report needs at least one work line and a valid date',()=>{assert.equal(visitReportReady(base),true);assert.equal(visitReportReady({...base,workDone:'  \n - '}),false);assert.equal(visitReportReady({...base,visitDate:''}),false);});
