import test from 'node:test';
import assert from 'node:assert/strict';
import {taskResolution} from '../apps/web/lib/field-agent-resolution.ts';
test('saved forward transition resolves previous admin task as completed',()=>{
 assert.equal(taskResolution('schedule','quote','reviewing'),'completed');
 assert.equal(taskResolution('quote','work','quoted'),'completed');
 assert.equal(taskResolution('work','invoice','quoted'),'completed');
 assert.equal(taskResolution('invoice','payment','quoted'),'completed');
 assert.equal(taskResolution('payment',null,'quoted'),'completed');
});
test('changes and cancellations are not credited as completed work',()=>{
 assert.equal(taskResolution('work','schedule','reviewing'),'superseded');
 assert.equal(taskResolution('quote','quote','reviewing'),'superseded');
 assert.equal(taskResolution('schedule',null,'declined'),'closed');
 assert.equal(taskResolution('invoice',null,'canceled'),'closed');
});
