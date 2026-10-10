/** Historical numbers remain unchanged. Monthly allocation happens in PostgreSQL. */
export function invoiceNumber(value:number|string):string {
 if(typeof value==='string')return value;
 if(!Number.isSafeInteger(value)||value<1)throw Error('INVALID_INVOICE_NUMBER');
 if(value<100001000000)return String(value);
 const month=Math.floor(value/1000000),sequence=value%1000000;
 if(month%100<1||month%100>12||month>999912||sequence<1)throw Error('INVALID_INVOICE_NUMBER');
 return `${month}-${String(sequence).padStart(4,'0')}`;
}
export function sampleInvoiceNumber(date:Date,timezone:string):number {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit'}).formatToParts(date);
 return Number(parts.find(p=>p.type==='year')!.value+parts.find(p=>p.type==='month')!.value)*1000000+1;
}
