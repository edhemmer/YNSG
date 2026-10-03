import test from 'node:test';
import assert from 'node:assert/strict';
// Exercise the real server boundary: malformed selections must never reach email delivery.
// @ts-expect-error The public Vercel handler is JavaScript.
import handler from '../api/requests.js';
test('public intake rejects malformed selection entries with 400 instead of throwing', async () => {
  for (const services of [[null], [false], [{}], [{ service: 'Yard & garden', task: null }]]) {
    let status = 0;
    let payload: unknown;
    const res = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { payload = value; return this; } };
    await handler({ method: 'POST', headers: { host: 'synthetic.invalid' }, body: { services } }, res);
    assert.equal(status, 400);
    assert.ok(payload);
  }
});
