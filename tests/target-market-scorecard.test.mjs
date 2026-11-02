import test from 'node:test';import assert from 'node:assert/strict';import {summarizeQueries} from '../scripts/target-market-scorecard.mjs';
test('SEO scorecard reports only actual matching query rows, without fabricating demand',()=>{
 const report=summarizeQueries('Query,Clicks,Impressions\n"lawn care st. charles il",3,40\n"yard cleanup campton hills",2,25\n"handyman dekalb",1,10\n"lawn care",4,99\n');
 assert.equal(report.markets['St. Charles'].clicks,3);assert.equal(report.markets['Campton Hills'].impressions,25);assert.equal(report.markets['DeKalb'].queryRows,1);assert.equal(report.markets['Geneva'].queryRows,0);assert.equal(report.unmatchedQueryRows,1);
});
test('SEO scorecard rejects invalid metrics',()=>assert.throws(()=>summarizeQueries('Query,Clicks,Impressions\n"yard geneva",no,4')));
