import {randomUUID} from 'node:crypto';
import {websiteGuard} from '../lib/website-guard.js';
import {providerEmail} from '../lib/transactional-email.js';
import {businessIdentity} from '../lib/business-identity.js';
import {marketingListEnabled, unsubscribeMarketing, MarketingFailure} from '../lib/marketing-db.js';

// Opt-out takes only an email address (or a personal link token). The answer is always the same,
// so it never reveals who is on the list. CAN-SPAM requires honoring this within 10 business days;
// once the marketing list is live it takes effect immediately.
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const TOKEN = /^[a-f0-9]{64}$/;
const DONE = {ok: true, message: 'You’re unsubscribed. You won’t receive marketing emails from Your Neighborhood Service Guy. Job and invoice emails you ask for will still arrive.'};
const fail = (res, status, error) => res.status(status).json({error});

export default async function handler(req, res, deps = {}) {
  const env = deps.env || process.env, transport = deps.transport || fetch;
  const guard = deps.guard || websiteGuard, mail = deps.mail || providerEmail, optOut = deps.optOut || unsubscribeMarketing;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }
  // One-click unsubscribe (RFC 8058): mail apps POST "List-Unsubscribe=One-Click" to the link in the
  // email header, with the personal code in the address and no browser origin.
  const oneClickToken = typeof req.query?.t === 'string' && TOKEN.test(req.query.t) ? req.query.t : null;
  if (oneClickToken && req.body && typeof req.body === 'object' && req.body['List-Unsubscribe'] === 'One-Click') {
    try { await optOut(req, {email: null, token: oneClickToken}, env, transport); return res.status(200).json(DONE); }
    catch { return fail(res, 503, 'Please use the unsubscribe link in the email.'); }
  }
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return fail(res, 403, 'Request not accepted.'); } catch { return fail(res, 403, 'Request not accepted.'); } }
  if (req.headers['sec-fetch-site'] === 'cross-site') return fail(res, 403, 'Request not accepted.');
  const raw = req.body;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Buffer.byteLength(JSON.stringify(raw)) > 1000) return fail(res, 400, 'Please enter your email address.');
  if (typeof raw.website === 'string' && raw.website.trim()) return res.status(200).json(DONE);
  const token = typeof raw.token === 'string' && TOKEN.test(raw.token) ? raw.token : null;
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  if (!token && (email.length < 5 || email.length > 254 || !EMAIL.test(email) || /[\r\n]/.test(email))) return fail(res, 400, 'Please enter a valid email address.');
  try { await guard(req, 'request', {key: randomUUID(), email: email || undefined}); }
  catch (error) { if (error?.status === 429) return fail(res, 429, 'Please wait a little while and try again, or email info@yourneighborhoodserviceguy.com with “unsubscribe.”'); return fail(res, 503, 'We couldn’t process that right now. Please try again, or email info@yourneighborhoodserviceguy.com with “unsubscribe.”'); }
  if (marketingListEnabled(env)) {
    try { await optOut(req, {email: token ? null : email, token}, env, transport); return res.status(200).json(DONE); }
    catch (error) { if (error instanceof MarketingFailure && error.status === 429) return fail(res, 429, 'Please wait a little while and try again.'); if (token) return fail(res, 503, 'We couldn’t process that right now. Please enter your email address instead.'); }
  }
  if (token) return fail(res, 503, 'Please enter your email address to unsubscribe.');
  // Until the list is live (or if it is briefly unavailable) the owner removes the address by hand.
  try {
    const id = randomUUID(), body = 'Marketing opt-out request\n\nRemove this address from all marketing emails: ' + email + '\n\nCAN-SPAM: honor within 10 business days. Reference: ' + id;
    await mail({action: 'send', organization: env.CRM_ORGANIZATION_ID, id, to: businessIdentity.email, subject: 'Unsubscribe request', body, html: '<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">' + body.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])) + '</pre>'}, env, transport);
  } catch { return fail(res, 503, 'We couldn’t process that right now. Please try again, or email info@yourneighborhoodserviceguy.com with “unsubscribe.”'); }
  return res.status(200).json(DONE);
}
