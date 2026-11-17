import {recordMarketingClick} from '../lib/marketing-db.js';
import {businessIdentity} from '../lib/business-identity.js';

// Marketing email links pass through here: the click is recorded (so emails go out when this person
// reads email), then the visitor continues to the page on this website. Only paths on this site are
// allowed, so the link can never be used to send someone elsewhere.
const PATH = /^\/[a-z0-9-/]{0,80}$/;
export default async function handler(req, res, deps = {}) {
  const record = deps.record || recordMarketingClick, env = deps.env || process.env, transport = deps.transport || fetch;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
  const q = req.query || {}, to = typeof q.to === 'string' && PATH.test(q.to) && !q.to.includes('//') ? q.to : '/';
  // Link scanners send HEAD or prefetch requests; only real visits count as clicks.
  if (req.method === 'GET' && typeof q.s === 'string' && !/bot|preview|scan|prefetch/i.test(String(req.headers['user-agent'] || '') + String(req.headers.purpose || req.headers['sec-purpose'] || ''))) {
    try { await record(req, q.s, env, transport); } catch { /* the visitor still gets the page */ }
  }
  res.setHeader('Location', businessIdentity.website + to);
  return res.status(302).end();
}
