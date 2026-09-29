import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { findService, exclusions } from '@/lib/services';

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = findService(slug);
  return { title: service?.title ?? 'Services', description: service?.description, alternates: { canonical: `/services/${slug}` } };
}
export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = findService(slug);
  if (!service) notFound();
  return <><section className="page-hero service-detail-hero"><div className="container"><Link href="/services" className="back-link"><ArrowLeft size={18} aria-hidden="true" /> All services</Link><p className="eyebrow">Home &amp; yard</p><h1>{service.title}</h1><p>{service.description}</p><Link className="button button-primary" href={`/request?service=${encodeURIComponent(service.title)}`}>Ask about {service.title.toLowerCase()} <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section><section className="section"><div className="container detail-grid"><div><p className="eyebrow">Common requests</p><h2>Here are a few examples.</h2></div><ul>{service.tasks.map(task => <li key={task}>{task}</li>)}</ul></div></section><section className="boundary-section"><div className="container boundary-grid"><h2>What falls outside our work</h2><p>{exclusions}</p></div></section></>;
}
