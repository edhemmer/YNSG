import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import {services,exclusions} from '@/lib/services';
export const metadata:Metadata={title:'Services'};
export default function Services(){return <div className="container inner"><p className="overline green">HOME &amp; YARD</p><h1>Practical help, clearly defined.</h1><p className="page-lead">Choose a service to see what’s included. We review every request and confirm scope and price before work is scheduled.</p><div className="service-grid two-col">{services.map(s=><Link href={`/services/${s.slug}`} className="service-card" key={s.slug}><span className="service-number">{s.number}</span><h2>{s.title}</h2><p>{s.short}</p><span className="text-link card-link">View details <ArrowRight size={18}/></span></Link>)}</div><div className="callout"><h2>Something else?</h2><p>Tell us about the task. We’ll let you know whether it fits our services.</p><Link href="/request" className="btn btn-navy">Ask about a job</Link></div><p className="scope"><strong>Our boundaries:</strong> {exclusions}</p></div>}
