import test from 'node:test';
import assert from 'node:assert/strict';
import {readServiceSelection,saveServiceSelection,clearServiceSelection,choicesFromUrl,validServiceChoices} from '../site/service-selection.js';
const jobs=[{service:'Lawn care',task:'Mowing'},{service:'Lawn care',task:'Leaf management'}];
function storage(){const data=new Map();return {data,getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('browsing draft retains only bounded canonical jobs, deduplicates and expires',()=>{
 const s=storage();assert.equal(saveServiceSelection(s,[...jobs,jobs[0],{service:'Other',task:'Invented'}],1000),true);assert.deepEqual(readServiceSelection(s,1001),jobs);assert.deepEqual(readServiceSelection(s,1000+24*60*60*1000),[]);assert.equal(s.data.size,0);saveServiceSelection(s,jobs,1000);assert.deepEqual(readServiceSelection(s,999),[]);saveServiceSelection(s,jobs);clearServiceSelection(s);assert.deepEqual(readServiceSelection(s),[]);assert.equal(validServiceChoices([{service:'__proto__',task:'toString'}]).length,0);
});
test('malformed URL/storage or blocked storage cannot break choosing work',()=>{
 const params=new URLSearchParams();params.append('job','broken');params.append('job',JSON.stringify(jobs[0]));params.append('job',JSON.stringify(jobs[0]));assert.deepEqual(choicesFromUrl(params),[jobs[0]]);const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};assert.deepEqual(readServiceSelection(blocked),[]);assert.equal(saveServiceSelection(blocked,jobs),false);assert.doesNotThrow(()=>clearServiceSelection(blocked));
});
