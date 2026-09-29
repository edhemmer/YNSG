import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Rates and Community Rate',
  description: 'Hourly home and yard help is $60 per hour with a two-hour minimum. A $45 Community Rate is available for seniors 70+, veterans, single moms and people with disabilities.',
  alternates: { canonical: '/pricing' },
};
export default function PricingPage() { return <>
  <section className="page-hero"><div className="container"><p className="eyebrow">Rates</p><h1>Let’s talk about the job and the cost before we set a time.</h1><p>These are our published hourly rates. We’ll confirm how your particular job is priced before any work begins.</p></div></section>
  <section className="section"><div className="container"><div className="price-grid"><article className="price-card"><p className="eyebrow">Hourly home &amp; yard work</p><h2>Standard rate</h2><p className="price"><strong>$60</strong> / hour</p><p>Two-hour minimum: <strong>$120</strong></p><p>After that, $30 for each additional 30 minutes.</p></article><article className="price-card price-community"><p className="eyebrow">🇺🇸 Community Rate</p><h2>For the neighbors we especially serve</h2><p className="price"><strong>$45</strong> / hour</p><p>Two-hour minimum: <strong>$90</strong></p><p>After that, $22.50 for each additional 30 minutes.</p></article></div><div className="rate-explain"><h2>Who can ask for the Community Rate?</h2><p>Seniors age 70 or older, veterans, single moms, and people with disabilities. Just select it on the request form or mention it when you call. We won’t ask for income information, paperwork, or a diagnosis.</p><p>The Community Rate applies to qualifying hourly work. Lawn care and snow clearing are priced separately. A standard residential lawn up to and including one-third acre starts at $50. We’ll talk through larger lawns and snow jobs before giving a price.</p><p>If materials, parts, or disposal are needed, we’ll discuss those costs with you before buying anything.</p><Link className="button button-primary" href="/request">Ask about your job</Link></div></div></section>
</>; }
