import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {DomainError} from '../packages/contracts/index.ts';
import {settingsIssue,settingsFieldLabel} from '../apps/web/lib/settings-validation.ts';
test('settings validation points to the business name instead of a generic save failure',()=>{
 const result=z.object({sellerLegalName:z.string().min(2)}).safeParse({sellerLegalName:''});
 assert.ok(!result.success);
 assert.equal(settingsIssue(result.error)?.path,'sellerLegalName');
 assert.ok(settingsIssue(result.error)?.message.startsWith('Business name:'));
});
test('command-envelope catalog errors locate the exact service and field',()=>{
 const result=z.object({catalog:z.array(z.object({scope:z.string().min(10)}))}).safeParse({catalog:[{scope:'Reviewed work'},{scope:''}]});
 assert.ok(!result.success);const issue=settingsIssue(result.error);
 assert.equal(issue?.path,'catalog.1.scope');assert.ok(issue?.message.startsWith('Service 2: included work:'));
 const wrapped=z.object({settings:z.object({cities:z.array(z.string().min(2))})}).safeParse({settings:{cities:['']}});
 assert.ok(!wrapped.success);assert.equal(settingsIssue(wrapped.error)?.path,'cities');
});
test('cross-field hours, horizon and color checks direct owners to a field they can correct',()=>{
 assert.equal(settingsIssue(new DomainError('VALIDATION','First start must be before last start'))?.path,'scheduling.latestStart');
 assert.equal(settingsIssue(new DomainError('VALIDATION','Last start must allow the minimum reservation'))?.path,'scheduling.endOfDay');
 assert.equal(settingsIssue(new DomainError('VALIDATION','Green/background colors need at least 4.5:1 contrast'))?.path,'brand.forest');
 assert.equal(settingsIssue(new DomainError('VALIDATION','Brand text/background pairs need at least 4.5:1 contrast'))?.path,'brand.navy');
 const result=z.object({scheduling:z.object({lead:z.number(),horizon:z.number()}).refine(v=>v.horizon>v.lead)}).safeParse({scheduling:{lead:24,horizon:12}});
 assert.ok(!result.success);assert.equal(settingsIssue(result.error)?.path,'scheduling.horizonMinutes');
 assert.ok(!JSON.stringify(settingsIssue(new Error('PRIVATE_DATABASE_ERROR'))).includes('PRIVATE_DATABASE_ERROR'));
 assert.equal(settingsFieldLabel('brand.logoUrl'),'Logo image link');
});
