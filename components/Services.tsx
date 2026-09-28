import Link from 'next/link';
import {services} from '@/lib/catalog';
export default function Services(){return <div className="service-grid">{services.map((s,i)=><article className="service-card" key={s.id}><span className="number">0{i+1}</span><h3><Link href={'/services/'+s.id}>{s.title}</Link></h3><p>{s.description}</p><Link className="text-link" href={'/request?service='+s.id}>Request {s.id==='something-else'?'your task':s.title.toLowerCase()} <span aria-hidden="true">↗</span></Link></article>)}</div>}
