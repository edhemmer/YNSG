import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Phone } from 'lucide-react';
import { RequestForm } from '@/components/request-form';
import { HeroGallery } from '@/components/hero-gallery';
import { services } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Home and yard help in DeKalb, Sycamore & Cortland',
  description: 'Need a hand around the house or yard? Ask about lawn care, garden beds, snow clearing, assembly and other everyday jobs in DeKalb, Sycamore and Cortland, Illinois.',
  alternates: { canonical: '/' },
};

export default function Home() {
  return <>
    <section className="hero" aria-labelledby="home-title">
      <div className="container hero-grid">
        <div className="hero-main">
          <p className="eyebrow">Your Neighborhood Service Guy · Home &amp; Yard</p>
          <h1 id="home-title">Need a hand around the house or yard?</h1>
          <p className="hero-lead">Maybe the garden beds need weeding, the lawn needs mowing, or a few small jobs inside keep getting pushed back. Tell us about it. We’ll let you know if we can help.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="#request">Send a request <ArrowUpRight size={20} aria-hidden="true" /></Link>
            <a className="button button-outline" href="tel:+17706302094"><Phone size={19} aria-hidden="true" /> Call 770-630-2094</a>
          </div>
          <p className="hero-local">Here in DeKalb, Sycamore &amp; Cortland, Illinois.</p>
        </div>
        <HeroGallery />
      </div>
    </section>

    <section className="community-strip" aria-label="Community Rate"><div className="container community-strip-inner"><span className="flag-mark" role="img" aria-label="American flag">🇺🇸</span><p><strong>Especially here for seniors, veterans, single moms, and people with disabilities.</strong> A Community Rate is available for qualifying hourly work.</p><Link href="/pricing">See the rates <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>

    <section className="section services-section" id="services" aria-labelledby="services-title">
      <div className="container">
        <div className="section-heading"><p className="eyebrow">Home &amp; yard</p><h2 id="services-title">What can we help with?</h2><p>Choose a place to start. If your job isn’t listed, tell us about it anyway.</p></div>
        <div className="service-list">
          {services.map((service, index) => <Link className="service-row" href={`/request?service=${encodeURIComponent(service.title)}`} key={service.slug}>
            <span className="service-number">0{index + 1}</span><span className="service-name">{service.title}</span><span className="service-description">{service.short}</span><ArrowUpRight size={24} aria-hidden="true" />
          </Link>)}
          <Link className="service-row service-other" href="/request?service=Something%20else"><span className="service-number">05</span><span className="service-name">Something else?</span><span className="service-description">Tell us about it. We’ll be honest about whether it’s a fit.</span><ArrowUpRight size={24} aria-hidden="true" /></Link>
        </div>
        <p className="services-footnote">A few examples: pulling weeds by hand, spreading mulch, mowing, snow clearing, putting furniture together, and help organizing at home. <Link href="/services">See the full service list and limits.</Link></p>
      </div>
    </section>

    <section className="section approach-section" aria-labelledby="approach-title"><div className="container approach-grid">
      <div><p className="eyebrow">How it works</p><h2 id="approach-title">Just tell us what you have in mind.</h2></div>
      <div className="approach-copy"><p>You can call, text, or send the short form below. We’ll look at the job and follow up if we have a question. Before we put anything on the calendar, we’ll agree on the work and what it will cost.</p><p>If it needs a licensed trade or falls outside the work we do, we’ll tell you plainly.</p></div>
    </div></section>

    <RequestForm />
  </>;
}
