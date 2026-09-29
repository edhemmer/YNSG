import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowRight,Check} from 'lucide-react';
import {findService,exclusions} from '@/lib/services';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;return {title:findService(slug)?.title??'Services'}}
export default async function Service({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const s=findService(slug);if(!s)notFound();return <div className="container inner detail"><Link href="/services" className="text-link"><ArrowLeft size={18}/> All services</Link><p className="overline green">HOME &amp; YARD / {s.title.toUpperCase()}</p><h1>{s.title}</h1><p className="page-lead">{s.description}</p><div className="detail-grid"><div><h2>Common requests</h2><ul className="check-list">{s.tasks.map(task=><li key={task}><Check size={19}/>{task}</li>)}</ul></div><div className="callout"><h2>Ready to ask?</h2><p>Share a few details and we’ll review the job before quoting or scheduling.</p><Link href={`/request?service=${s.category}`} className="btn btn-navy">Request this service <ArrowRight size={18}/></Link></div></div><p className="scope"><strong>Our boundaries:</strong> {exclusions}</p></div>}
