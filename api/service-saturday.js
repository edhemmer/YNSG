import {websiteGuard} from '../lib/website-guard.js';
import {providerEmail} from '../lib/transactional-email.js';
import {businessIdentity} from '../lib/business-identity.js';
import {serviceSaturday} from '../site/data/service-saturday.js';
import {acceptingEntries, validateEntry, entrySummary} from '../lib/service-saturday.js';
import {marketingListEnabled, saveCampaignEntry, MarketingFailure} from '../lib/marketing-db.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const send = (res, status, body) => res.status(status).json(body);
const fail = (res, status, error) => send(res, status, {error});
const escapeHtml = value => value.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));

export default async function handler(req, res, deps = {}) {
  const env = deps.env || process.env, transport = deps.transport || fetch, now = deps.now || new Date();
  const guard = deps.guard || websiteGuard, mail = deps.mail || providerEmail, save = deps.save || saveCampaignEntry;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return fail(res, 403, 'Request not accepted.'); } catch { return fail(res, 403, 'Request not accepted.'); } }
  if (req.headers['sec-fetch-site'] === 'cross-site') return fail(res, 403, 'Request not accepted.');
  if (Number(req.headers['content-length'] || 0) > 8000 || !req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Buffer.byteLength(JSON.stringify(req.body)) > 8000) return fail(res, 400, 'Please check the form and try again.');
  const raw = req.body;
  if (typeof raw.website === 'string' && raw.website.trim()) return send(res, 200, {ok: true});
  if (!acceptingEntries(deps.config || serviceSaturday, now)) return fail(res, 410, 'Service Saturday entries are closed right now. Thanks for your interest!');
  if (typeof raw.requestKey !== 'string' || !UUID.test(raw.requestKey)) return fail(res, 400, 'Please refresh the page and try again.');
  const checked = validateEntry(raw);
  if (!checked.ok) return fail(res, 400, 'Please check the required fields and try again.');
  const {data} = checked, key = raw.requestKey, campaign = (deps.config || serviceSaturday).campaign;
  try { await guard(req, 'request', {key, email: data.entrantEmail}); }
  catch (error) { if (error?.status === 429) { res.setHeader('Retry-After', '3600'); return fail(res, 429, 'Please wait a little while before trying again, or call 815-680-1775.'); } return fail(res, 503, 'We couldn’t send your entry right now. Please try again, or call 815-680-1775.'); }

  let saved = false, duplicate = false;
  if (marketingListEnabled(env)) {
    try { const result = await save(req, campaign, key, data, env, transport); saved = true; duplicate = result.duplicate; }
    catch (error) {
      if (error instanceof MarketingFailure && error.status === 429) { res.setHeader('Retry-After', '3600'); return fail(res, 429, 'Please wait a little while before trying again, or call 815-680-1775.'); }
      if (error instanceof MarketingFailure && error.status === 400) return fail(res, 400, 'Please check the required fields and try again.');
      console.warn('Service Saturday entry could not be saved', {code: error instanceof MarketingFailure ? error.code : 'UNKNOWN'});
    }
  }
  if (duplicate) return send(res, 200, {ok: true, duplicate: true});
  // The owner gets every new entry by email. Without a saved copy, the email is the record, so it must succeed.
  try {
    const body = entrySummary(data, campaign, key) + (saved ? '' : '\n\nNot yet saved to the marketing list: add this person by hand.');
    await mail({action: 'send', organization: env.CRM_ORGANIZATION_ID, id: key, to: businessIdentity.email, replyTo: data.entrantEmail, subject: 'Service Saturday entry: ' + data.entrantName, body, html: '<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">' + escapeHtml(body) + '</pre>'}, env, transport);
  } catch {
    if (!saved) { console.warn('Service Saturday entry could not be confirmed', {code: 'DELIVERY_UNAVAILABLE'}); return fail(res, 503, 'We couldn’t send your entry right now. Please try again, or call 815-680-1775.'); }
  }
  return send(res, 200, {ok: true, duplicate: false});
}
