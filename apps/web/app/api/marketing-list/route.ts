import {NextResponse} from 'next/server';
import {authenticated, sameOrigin} from '../../../lib/session';
import {boundedText} from '../../../lib/bounded-request';
import {marketingQuery, marketingCommand, marketingSummary, marketingExport, campaignEntries, campaignDraw, crmFeed, marketingCsv} from '../../../lib/marketing-list';
import {serviceSaturday} from '../../../../../site/data/service-saturday.js';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control': 'private, no-store'};

// Owner-only marketing list tools. Every database function re-checks current owner/admin access.
function fail(code: string) {
  const message = code === 'UNAUTHORIZED' ? 'Sign in to view the marketing list.' : code === 'FORBIDDEN' ? 'Owner access is required.' : code === 'NO_ELIGIBLE_ENTRIES' ? 'There are no entries left to draw.' : code === 'BELOW_MINIMUM' ? 'The rules require ' + serviceSaturday.minimumEntries + ' eligible entries before the drawing.' : code === 'VALIDATION' ? 'Please check the request and try again.' : 'The marketing list could not be loaded. Try again.';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NO_ELIGIBLE_ENTRIES' || code === 'BELOW_MINIMUM' ? 409 : code === 'VALIDATION' ? 400 : 503;
  return NextResponse.json({error: message, code}, {status, headers});
}
const code = (error: {code?: string; message?: string}) => error.code === '42501' ? 'FORBIDDEN' : error.message || 'UNAVAILABLE';

export async function GET(request: Request) {
  try {
    const parsed = marketingQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return fail('VALIDATION');
    const q = parsed.data, {db} = await authenticated();
    if (q.view === 'summary') {
      const r = await db.rpc('marketing_owner_summary', {p_org: q.organization});
      if (r.error) return fail(code(r.error));
      const data = marketingSummary.parse(r.data);
      if (data.organization !== q.organization) throw Error('UNVERIFIED');
      return NextResponse.json(data, {headers});
    }
    if (q.view === 'export') {
      const r = await db.rpc('marketing_owner_export', {p_org: q.organization});
      if (r.error) return fail(code(r.error));
      const csv = marketingCsv(marketingExport.parse(r.data));
      return new NextResponse(csv, {headers: {...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ynsg-email-list-' + new Date().toISOString().slice(0, 10) + '.csv"'}});
    }
    if (!q.campaign) return fail('VALIDATION');
    const r = await db.rpc('campaign_owner_entries', {p_org: q.organization, p_campaign: q.campaign});
    if (r.error) return fail(code(r.error));
    const data = campaignEntries.parse(r.data);
    if (data.campaign !== q.campaign) throw Error('UNVERIFIED');
    return NextResponse.json(data, {headers});
  } catch (e) { return fail(e instanceof Error && e.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'UNAVAILABLE'); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('FORBIDDEN');
  try {
    const raw = await boundedText(request, 1000);
    const parsed = marketingCommand.safeParse(JSON.parse(raw));
    if (!parsed.success) return fail('VALIDATION');
    const c = parsed.data, {db} = await authenticated();
    if (c.action === 'draw') {
      // Service Saturday rules: no first drawing until the minimum number of entries is in.
      if (c.campaign === serviceSaturday.campaign) {
        const e = await db.rpc('campaign_owner_entries', {p_org: c.organization, p_campaign: c.campaign});
        if (e.error) return fail(code(e.error));
        const current = campaignEntries.parse(e.data);
        if (current.campaign !== c.campaign) throw Error('UNVERIFIED');
        if (!current.draws.length && current.entries.length < serviceSaturday.minimumEntries) return fail('BELOW_MINIMUM');
      }
      const r = await db.rpc('campaign_owner_draw', {p_org: c.organization, p_campaign: c.campaign});
      if (r.error) return fail(code(r.error));
      const data = campaignDraw.parse(r.data);
      if (data.campaign !== c.campaign) throw Error('UNVERIFIED');
      return NextResponse.json(data, {headers});
    }
    const r = await db.rpc('marketing_owner_crm_feed', {p_org: c.organization, p_enabled: c.enabled});
    if (r.error) return fail(code(r.error));
    const data = crmFeed.parse(r.data);
    if (data.organization !== c.organization || (data.crmFeedStartsAt !== null) !== c.enabled) throw Error('UNVERIFIED');
    return NextResponse.json(data, {headers});
  } catch (e) { return fail(e instanceof Error && e.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'UNAVAILABLE'); }
}
