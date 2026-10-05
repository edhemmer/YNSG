// Format only the canonical scheduling strings; preserve other customer wording.
const dateLabel=(value)=>{
 const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)return null;
 return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date);
};
const timeLabel=(value)=>{const [h,m]=value.split(':').map(Number);if(h>23||m>59)return null;return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;};
export function requestTiming(value,fallback='We’ll arrange a day and time with you.'){
 if(typeof value!=='string'||!value.trim())return fallback;
 const once=value.match(/^(\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2}) America\/Chicago\. Owner approval required\.$/);
 if(once){const date=dateLabel(once[1]),time=timeLabel(once[2]);if(date&&time)return `${date} at ${time} (local time)`;}
 const weekly=value.match(/^Weekly (Monday|Tuesday|Wednesday|Thursday|Friday) (\d{2}:\d{2}); (\d{4}-\d{2}-\d{2}) to before (\d{4}-\d{2}-\d{2}); America\/Chicago; 12 months\. Owner approval required\.$/);
 if(weekly){const date=dateLabel(weekly[3]),time=timeLabel(weekly[2]);if(date&&time)return `Every ${weekly[1]} at ${time} (local time), starting ${date}, for 12 months.`;}
 if(value==='Weekly visits for 12 months; weekday and time to be arranged. Owner approval required.')return 'Weekly visits for 12 months; we’ll arrange the weekday and time with you.';
 return value;
}
