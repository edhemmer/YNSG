import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reviewsSection,validReviews,minimumReviewsToShow,ratingBadge,validRating} from '../site/reviews.js';
import {meetEdVideo} from '../site/meet-ed.js';
const r=(n,extra={})=>({name:'Pat M'+n,town:'Sycamore',rating:5,text:'Showed up right on time and did great work.',date:'2026-11-0'+n,...extra});
test('reviews stay hidden until three real reviews exist, then show newest first, escaped',()=>{
 assert.equal(reviewsSection([],'https://g.page/r/x/review'),'');
 assert.equal(reviewsSection([r(1),r(2)],'https://g.page/r/x/review'),'');
 const html=reviewsSection([r(1),r(3),r(2,{text:'<script>alert(1)</script> great job overall'})],'https://g.page/r/x/review');
 assert.match(html,/What customers say/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.ok(html.indexOf('Pat M3')<html.indexOf('Pat M1'));assert.equal(minimumReviewsToShow,3);
});
test('invalid reviews fail the build instead of publishing',()=>{
 assert.throws(()=>validReviews([r(1,{rating:6})]));assert.throws(()=>validReviews([r(1,{text:'short'})]));assert.throws(()=>validReviews({}));
});
test('the shipped review list is real-data only and currently empty',async()=>{
 assert.deepEqual(JSON.parse(await readFile('site/data/reviews.json','utf8')),[]);
});
test('Meet Ed video renders only with the file, with captions when provided',()=>{
 assert.equal(meetEdVideo({hasVideo:false,hasPoster:true,hasCaptions:true}),'');
 const html=meetEdVideo({hasVideo:true,hasPoster:true,hasCaptions:true});
 assert.match(html,/<video controls playsinline preload="metadata" poster="\/assets\/meet-ed.jpg">/);assert.match(html,/kind="captions"/);assert.doesNotMatch(html,/autoplay/);
 assert.doesNotMatch(meetEdVideo({hasVideo:true,hasPoster:false,hasCaptions:false}),/poster|track/);
});
test('the Google rating badge shows stars and rating only, no review count, never a quote, and rejects bad data',()=>{
 const html=ratingBadge({rating:5,count:1,asOf:'2026-11-11'},'https://g.page/r/x');
 assert.match(html,/5\.0/);assert.doesNotMatch(html,/review</);assert.doesNotMatch(html,/1 review/);assert.match(html,/href="https:\/\/g\.page\/r\/x"/);assert.doesNotMatch(html,/blockquote/);
 assert.doesNotMatch(ratingBadge({rating:4.6,count:12,asOf:'2026-11-11'},'https://g.page/r/x'),/12/);
 assert.equal(ratingBadge(null,'https://g.page/r/x'),'');
 assert.throws(()=>validRating({rating:6,count:1,asOf:'2026-11-11'}));assert.throws(()=>validRating({rating:5,count:0,asOf:'2026-11-11'}));
});
