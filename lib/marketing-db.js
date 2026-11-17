import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

// Saves to the marketing list only after the marketing_list_and_campaign_entries migration is
// applied and MARKETING_LIST_ENABLED=true is set. Until then callers fall back to emailing the owner.
export class MarketingFailure extends Error {constructor(code, status) {super(code); this.code = code; this.status = status;}}
export const marketingListEnabled = (env = process.env) => env.MARKETING_LIST_ENABLED === 'true';

function setup(req, env, purpose) {
  const organization = env.CRM_ORGANIZATION_ID, secret = env.CRM_INTAKE_HASH_KEY, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new MarketingFailure('SETUP_REQUIRED', 503); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !serviceKey || !secret || secret.length < 32 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(organization || '')) throw new MarketingFailure('SETUP_REQUIRED', 503);
  const address = env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  if (typeof address !== 'string' || !isIP(address.trim())) throw new MarketingFailure('SETUP_REQUIRED', 503);
  const clientHash = createHmac('sha256', secret).update(`ynsg:${purpose}:v1:${organization}:${address.trim()}`).digest('hex');
  return {organization, serviceKey, url, clientHash};
}

async function rpc(name, body, {serviceKey, url}, transport) {
  let response;
  try {
    response = await transport(new URL('/rest/v1/rpc/' + name, url), {method: 'POST', headers: {'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`}, body: JSON.stringify(body), signal: AbortSignal.timeout(10000)});
  } catch { throw new MarketingFailure('UNAVAILABLE', 503); }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof result?.message === 'string' ? result.message : '';
    if (code === 'RATE_LIMITED') throw new MarketingFailure(code, 429);
    if (code === 'VALIDATION') throw new MarketingFailure(code, 400);
    throw new MarketingFailure('UNAVAILABLE', 503);
  }
  if (result?.ok !== true) throw new MarketingFailure('UNAVAILABLE', 503);
  return result;
}

export async function saveCampaignEntry(req, campaign, key, data, env = process.env, transport = fetch) {
  const s = setup(req, env, 'campaign');
  const result = await rpc('submit_campaign_entry', {p_org: s.organization, p_campaign: campaign, p_key: key, p_client_hash: s.clientHash, p_data: data}, s, transport);
  return {id: result.id, duplicate: result.duplicate === true};
}

export async function unsubscribeMarketing(req, {email = null, token = null}, env = process.env, transport = fetch) {
  const s = setup(req, env, 'optout');
  await rpc('unsubscribe_marketing', {p_org: s.organization, p_token: token, p_email: email, p_client_hash: s.clientHash}, s, transport);
  return {ok: true};
}
