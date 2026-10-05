import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {publicError} from '../apps/web/lib/public-errors.ts';
test('unknown provider, database, network and parsing failures never reach app screens',()=>{
 const fallback='We could not complete that action. Please try again. If it keeps happening, contact the business.';
 for(const value of ['42501 relation private.tokens','TypeError: Failed to fetch','SyntaxError: Unexpected token <','UNREGISTERED_SECRET_KEY','Error: SELECT * FROM secrets\n at server.ts:42','https://provider.invalid?token=synthetic','<script>alert(1)</script>'])assert.equal(publicError(new Error(value)),fallback);
 assert.equal(publicError(null),fallback);assert.equal(publicError({message:'untrusted object'}),fallback);
});
test('reviewed errors retain useful instructions and known codes become plain language',()=>{
 assert.equal(publicError(new Error('STALE_REVISION')),'This record changed. Refresh before continuing.');
 assert.equal(publicError('That code is invalid or expired. Request a new code.'),'That code is invalid or expired. Request a new code.');
 assert.equal(publicError('RECONNECT_REQUIRED').includes('RECONNECT_REQUIRED'),false);
});
test('public website form filters injected diagnostics but retains reviewed validation and retry messages',()=>{
 const main=readFileSync('site/main.js','utf8');
 const source=main.slice(main.indexOf('function requestErrorMessage(')).split('// End public error helper.')[0]!;
 const safe=runInNewContext(source+'\nrequestErrorMessage;') as (error:unknown)=>string;
 for(const message of ['SyntaxError: invalid JSON','UNAUTHORIZED_DATABASE','<html>proxy trace</html>','provider secret=synthetic'])assert.equal(safe({message}).includes(message),false);
 assert.equal(safe('Please check the required fields and try again.'),'Please check the required fields and try again.');
 assert.match(safe({message:'Failed to fetch'}),/could not confirm/);assert.match(safe(null),/770-630-2094/);
});
