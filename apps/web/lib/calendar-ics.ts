type Feed={name:string;events:{id:string;revision:number;start:string;end:string;updatedAt:string;status:string;customer:string|null;address:string|null}[]};
const escape=(v:string)=>v.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=(v:string)=>{const date=new Date(v);if(!Number.isFinite(date.getTime()))throw Error('INVALID_CALENDAR_DATE');return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')};
function fold(line:string){let result='',part='';for(const c of line){if(Buffer.byteLength(part+c)>74){result+=part+'\r\n';part=' '+c;}else part+=c;}return result+part;}
export function calendarIcs(feed:Feed){if(feed.events.length>2000)throw Error('CALENDAR_TOO_LARGE');return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//YNSG//Owner Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escape(feed.name),...feed.events.flatMap(e=>['BEGIN:VEVENT','UID:'+e.id+'@ynsg-calendar','SEQUENCE:'+e.revision,'DTSTAMP:'+stamp(e.updatedAt),'DTSTART:'+stamp(e.start),'DTEND:'+stamp(e.end),'SUMMARY:'+escape(e.customer?'Service visit · '+e.customer:'Service appointment'),...(e.address?['LOCATION:'+escape(e.address)]:[]),'STATUS:'+(e.status==='canceled'?'CANCELLED':'CONFIRMED'),'END:VEVENT']),'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';}

export type VisitInvite={appointmentId:string;revision:number;start:string;company:string;address:string|null;phone?:string|null;updatedAt?:string;hours?:number};
// One event the customer adds to their own calendar. The UID is stable and SEQUENCE follows the appointment
// revision, so a rescheduled confirmation updates the same event instead of creating a duplicate.
export function visitInviteIcs(v:VisitInvite){
 if(!/^[a-f0-9-]{8,64}$/i.test(v.appointmentId))throw Error('INVALID_INVITE_ID');
 const start=new Date(v.start);if(!Number.isFinite(start.getTime()))throw Error('INVALID_CALENDAR_DATE');
 const end=new Date(start.getTime()+(v.hours??2)*3600000);
 const note='Arrival window starts at this time. Need to reach us? Reply to the confirmation email'+(v.phone?' or call '+v.phone:'')+'.';
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//YNSG//Service Visit//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+v.appointmentId+'@yourneighborhoodserviceguy.com','SEQUENCE:'+Math.max(0,Math.floor(v.revision)),'DTSTAMP:'+stamp(v.updatedAt||new Date().toISOString()),'DTSTART:'+stamp(start.toISOString()),'DTEND:'+stamp(end.toISOString()),'SUMMARY:'+escape('Service visit · '+v.company),'DESCRIPTION:'+escape(note),...(v.address?['LOCATION:'+escape(v.address)]:[]),'STATUS:CONFIRMED','TRANSP:OPAQUE','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+escape('Service visit tomorrow'),'TRIGGER:-P1D','END:VALARM','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
