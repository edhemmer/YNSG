import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { services, exclusions } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Home and yard services',
  description: 'Lawn care, garden-bed weeding, yard help, residential snow clearing and help around the home in DeKalb, Sycamore and Cortland, Illinois.',
  alternates: { canonical: '/services' },
};

export default function ServicesPage() { return <>
  <section className="page-hero"><div className="container"><p className="eyebrow">Services</p><h1>Small jobs can pile up. Let’s talk about yours.</h1><p>These are the kinds of jobs we get asked about. If you have something else in mind, tell us and we’ll let you know if we can take it on.</p></div></section>
  <section className="section"><div className="container"><div className="service-list service-list-page">{services.map((service, index) => <Link href={`/services/${service.slug}`} className="service-row" key={service.slug}><span className="service-number">0{index + 1}</span><span className="service-name">{service.title}</span><span className="service-description">{service.short}</span><ArrowUpRight size={24} aria-hidden="true" /></Link>)}</div><div className="other-panel"><div><h2>Have another job in mind?</h2><p>Choose “Something else” on the request form and tell us a little about it.</p></div><Link className="button button-primary" href="/request?service=Something%20else">Ask about your job</Link></div></div></section>
  <section className="boundary-section"><div className="container boundary-grid"><h2>Some work is best left to a specialist.</h2><p>{exclusions}</p></div></section>
</>; }
