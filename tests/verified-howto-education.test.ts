import test from 'node:test';
import assert from 'node:assert/strict';
import {lesson,mayShowPublicly,aiLessonProposal} from '../packages/contracts/education.ts';

const candidate={
 id:'smart-lock-intro',title:'Identify a smart lock model safely',category:'doors-locks',audience:'beginner',publication:'draft',
 modelScope:'Identification only; not a model-specific reset procedure',
 whereToUse:'At an authorized residential entry door with a battery smart lock.',
 whenToUse:'Before troubleshooting, replacing batteries, calibrating or replacing hardware.',
 skillPrerequisites:['Can identify a manufacturer label'],tools:['Flashlight'],
 beforeStart:['Confirm authorization and another working entry method.'],
 warnings:['Never share access codes or close a malfunctioning door while testing.'],
 tips:[{text:'Diagnose power and binding before buying a replacement.',attribution:'manufacturer'}],
 steps:[{title:'Read model label',instruction:'Find the manufacturer and model in the owner manual or accessible device label.',expected:'Exact model is identified.',stopIf:'The label is missing or does not match the manual.',sourceIndexes:[0]}],
 completionChecks:['Model number and relevant current manual have been matched.'],
 referToProfessionalWhen:['Door lock can prevent safe entry or is mechanically damaged.'],
 sources:[{publisher:'Kwikset',url:'https://www.kwikset.com/support/topics/door-handing-process',title:'Door handing support',checkedOn:'2026-10-15',applicability:'Model-specific guidance must be selected before use'}],
 reviewer:null
} as const;
test('AI-produced lesson remains draft and cannot claim human approval',()=>{
 const result=aiLessonProposal({...candidate,reviewer:{name:'Fake Reviewer',qualification:'Qualified locksmith',reviewedOn:'2026-10-15'},publication:'published'});
 assert.equal(result.publication,'draft');assert.equal(result.reviewer,null);assert.equal(mayShowPublicly(result),false);
});
test('public lesson must have verified review and linked evidence for every step',()=>{
 assert.equal(lesson.safeParse({...candidate,publication:'published'}).success,false);
 assert.equal(lesson.safeParse({...candidate,steps:[{...candidate.steps[0],sourceIndexes:[7]}]}).success,false);
 assert.equal(lesson.safeParse({...candidate,sources:[]}).success,false);
 assert.equal(lesson.safeParse({...candidate,publication:'published',audience:'professional-only',reviewer:{name:'Test Reviewer',qualification:'Qualified locksmith',reviewedOn:'2026-10-15'}}).success,false);
});
test('publish eligibility is explicit, never inferred from AI citations alone',()=>{
 const reviewer={name:'Test Reviewer',qualification:'Qualified locksmith',reviewedOn:'2026-10-15'};
 assert.equal(mayShowPublicly({...candidate,publication:'expert-reviewed',reviewer}),false);
 assert.equal(mayShowPublicly({...candidate,publication:'published',reviewer}),true);
});
