import {NextResponse} from 'next/server';
import {authenticated, sameOrigin} from '../../../lib/session';
import {boundedText} from '../../../lib/bounded-request';
import {randomUUID} from 'node:crypto';
import {automationQuery, automationCommand, automationSummary, automationTest, customerMarketingStatus} from '../../../lib/marketing-automation';
import {sendBusinessEmail} from '../../../lib/transactional-mail';
import {businessIdentity} from '../../../../../lib/business-identity.js';
import {marketingEmail} from '../../../lib/marketing-emails';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control': 'private, no-store'};

// Owner controls for automated marketing email. Every database function re-checks current access.
function fail(code: string) {
  const message = code === 'UNAUTHORIZED' ? 'Sign in to manage email automation.' : code === 'FORBIDDEN' ? 'Owner access is required.' : code === 'VALIDATION' ? 'Please check the settings and try again.' : 'Email automation could not be loaded. Try again.';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'VALIDATION' ? 400 : 503;
  return NextResponse.json({error: message, code}, {status, headers});
}
const code = (error: {code?: string; message?: string}) => error.code === '42501' ? 'FORBIDDEN' : error.message === 'VALIDATION' ? 'VALIDATION' : 'UNAVAILABLE';
const centralMonth = () => Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Chicago', month: 'numeric'}).format(new Date()));

export async function GET(request: Request) {
  try {
    const parsed = automationQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return fail('VALIDATION');
    const q = parsed.data, {db} = await authenticated();
    if (q.view === 'customer') {
      if (!q.customer) return fail('VALIDATION');
      const c = await db.rpc('marketing_customer_status', {p_org: q.organization, p_customer: q.customer});
      if (c.error) return fail(code(c.error));
      return NextResponse.json(customerMarketingStatus.parse(c.data), {headers});
    }
    const r = await db.rpc('marketing_automation_owner', {p_org: q.organization});
    if (r.error) return fail(code(r.error));
    const data = automationSummary.parse(r.data);
    if (q.view === 'summary') return NextResponse.json(data, {headers});
    // Preview with a sample name and placeholder links (only after the access check above).
    const m = marketingEmail({journey: q.journey || 'monthly', audience: q.audience || 'customer', month: q.month || centralMonth(), name: 'Pat Neighbor', sendId: '00000000-0000-4000-8000-000000000000', token: '0'.repeat(64)});
    return new NextResponse(m.html, {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; sandbox", 'X-Subject': encodeURIComponent(m.subject)}});
  } catch (e) { return fail(e instanceof Error && e.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'UNAVAILABLE'); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('FORBIDDEN');
  try {
    const raw = JSON.parse(await boundedText(request, 1000));
    const test = automationTest.safeParse(raw);
    if (test.success) {
      const t = test.data, {db, user} = await authenticated();
      // Same owner/admin check as the Marketing screen before anything is sent.
      const access = await db.rpc('marketing_automation_owner', {p_org: t.organization});
      if (access.error) return fail(code(access.error));
      if (!user.email) return fail('VALIDATION');
      const m = marketingEmail({journey: t.journey, audience: t.audience, month: t.month, name: (user.user_metadata?.full_name as string | undefined) || 'Ed', sendId: '00000000-0000-4000-8000-000000000000', token: '0'.repeat(64)});
      await sendBusinessEmail(t.organization, randomUUID(), {to: user.email, subject: '[Test] ' + m.subject, body: m.body, html: m.html, replyTo: businessIdentity.email});
      return NextResponse.json({sent: true, to: user.email}, {headers});
    }
    const parsed = automationCommand.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION');
    const c = parsed.data, {db} = await authenticated();
    const r = await db.rpc('marketing_automation_update', {p_org: c.organization, p_enabled: c.enabled, p_journeys_off: c.journeysOff, p_monthly_cap: c.monthlyCap, p_daily_cap: c.dailyCap});
    if (r.error) return fail(code(r.error));
    const data = automationSummary.parse(r.data);
    if (data.enabled !== c.enabled || data.monthlyCap !== c.monthlyCap || data.dailyCap !== c.dailyCap) throw Error('UNVERIFIED');
    return NextResponse.json(data, {headers});
  } catch (e) { return fail(e instanceof Error && e.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'UNAVAILABLE'); }
}
