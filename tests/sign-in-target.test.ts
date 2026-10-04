import test from 'node:test';
import assert from 'node:assert/strict';
import { signInTarget } from '../apps/web/lib/sign-in-target.ts';
test('default email return selects the verified membership workspace, never email or an arbitrary path', () => {
 assert.equal(signInTarget(undefined, [{role:'owner'}]), '/owner');
 assert.equal(signInTarget(undefined, [{role:'admin'}]), '/owner');
 assert.equal(signInTarget(undefined, [{role:'dispatcher'}]), '/');
 assert.equal(signInTarget(undefined, []), '/account');
 assert.equal(signInTarget('https://untrusted.invalid', []), '/account');
 assert.equal(signInTarget(undefined, [{role:'owner', revoked_at:'2026-10-04T00:00:00Z'}]), '/account');
});
test('owner email return and Google setup preserve intended fixed destination; recovery remains in account', () => {
 assert.equal(signInTarget('owner', []), '/owner');
 assert.equal(signInTarget('google-owner', [{role:'owner'}]), '/owner?setup=google');
 assert.equal(signInTarget('password', [{role:'owner'}]), '/account?password=change');
 assert.equal(signInTarget('account', [{role:'owner'}]), '/account');
});
