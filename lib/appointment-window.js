export const BUSINESS_TIMEZONE='America/Chicago';
const DAY=86400000;
export function localDay(now=Date.now(),timezone=BUSINESS_TIMEZONE){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(day,days){
 const d=new Date(day+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==day||!Number.isInteger(days))throw Error('INVALID_DATE');
 return new Date(+d+days*DAY).toISOString().slice(0,10);
}
export function yearEnd(day){
 addDays(day,0);
 const [year,month,date]=day.split('-').map(Number),last=new Date(Date.UTC(year+1,month,0)).getUTCDate();
 return `${year+1}-${String(month).padStart(2,'0')}-${String(Math.min(date,last)).padStart(2,'0')}`;
}
// End is exclusive. Advance calendar dates, never 168 elapsed hours across DST.
export function weeklyDates(first){const end=yearEnd(first),dates=[];for(let day=first;day<end;day=addDays(day,7))dates.push(day);return {end,dates};}
export function appointmentSelection(input,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['mode','start'].includes(k))||!['once','weekly'].includes(input.mode))throw Error('INVALID_SELECTION');
 if(!input.start)return {mode:input.mode,start:null,preferredTime:input.mode==='weekly'?'Weekly visits for 12 months; weekday and time to be arranged. Owner approval required.':''};
 if(typeof input.start!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(input.start))throw Error('INVALID_SELECTION');
 const instant=Date.parse(input.start),today=localDay(now),day=localDay(instant);
 if(!Number.isFinite(instant)||instant<=now||day<today||day>addDays(today,30))throw Error('OUTSIDE_WINDOW');
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:BUSINESS_TIMEZONE,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(x=>[x.type,x.value]));
 const minute=Number(p.hour)*60+Number(p.minute);
 if(['Saturday','Sunday'].includes(p.weekday)||minute<480||minute>900||minute%30)throw Error('INVALID_SELECTION');
 const time=`${p.hour}:${p.minute}`;
 return {mode:input.mode,start:new Date(instant).toISOString(),weekday:p.weekday,localTime:time,firstDate:day,endExclusive:input.mode==='weekly'?yearEnd(day):null,preferredTime:input.mode==='weekly'?`Weekly ${p.weekday} ${time}; ${day} to before ${yearEnd(day)}; America/Chicago; 12 months. Owner approval required.`:`${day} at ${time} America/Chicago. Owner approval required.`};
}
