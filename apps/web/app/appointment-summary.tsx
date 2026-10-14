import type {Visit} from '../lib/request-inbox';
import Icon from './crm-icons';
export default function AppointmentSummary({visit,timezone}:{visit:Visit;timezone:string}){
 const arrival=new Date(visit.arrival_at||visit.start_at),start=new Date(visit.start_at),end=new Date(visit.end_at);
 const format=(value:Date,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,...options}).format(value);
 const tone=visit.status==='reserved'?'confirmed':visit.status==='proposal'?'proposed':'review';
 const status=tone==='confirmed'?'Confirmed':tone==='proposed'?'Awaiting approval':'Needs review';
 const sameDay=format(start,{year:'numeric',month:'numeric',day:'numeric'})===format(end,{year:'numeric',month:'numeric',day:'numeric'});
 return <article className={'visit-summary visit-summary-'+tone} aria-label={status+' appointment'}>
  <header><span className="visit-state"><Icon name={tone==='confirmed'?'check':tone==='proposed'?'clock':'bell'}/>{status}</span><span className="visit-zone">{new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeZoneName:'short'}).formatToParts(arrival).find(p=>p.type==='timeZoneName')?.value||timezone.replaceAll('_',' ')}</span></header>
  <div className="visit-summary-main"><div className="visit-date-tile" aria-hidden="true"><span>{format(arrival,{month:'short'})}</span><strong>{format(arrival,{day:'numeric'})}</strong><span>{format(arrival,{weekday:'short'})}</span></div><div><p className="visit-date-label">{format(arrival,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</p><span className="visit-field-label">Customer arrival</span><strong className="visit-arrival"><Icon name="clock"/><time dateTime={arrival.toISOString()}>{format(arrival,{hour:'numeric',minute:'2-digit'})}</time></strong></div></div>
  <dl className="visit-window"><div><dt><Icon name="work"/>Reserved work window</dt><dd>{format(start,{hour:'numeric',minute:'2-digit'})} – {format(end,sameDay?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</dd></div></dl>
  {visit.replaces_id&&visit.status==='proposal'&&<p className="visit-retained">Original visit stays booked until you approve this time.</p>}
 </article>;
}
