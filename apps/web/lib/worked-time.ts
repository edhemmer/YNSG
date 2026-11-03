/** Exact hours:minutes entry; never treat 1:20 as 1.2 decimal hours. */
export function workedTimeMinutes(value:string):number|null{const match=/^(\d{1,2}):([0-5]\d)$/.exec(value.trim());if(!match)return null;const minutes=Number(match[1])*60+Number(match[2]);return minutes<=1440?minutes:null;}
export function workedTimeLabel(minutes:number):string{if(!Number.isSafeInteger(minutes)||minutes<0||minutes>1440)return '';return Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0');}
