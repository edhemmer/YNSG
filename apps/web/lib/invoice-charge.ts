// Keep the typed amount intact; reject fractions of a cent instead of rounding.
export function invoiceChargeCents(amount:string):number|null{
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(amount))return null;
 const [whole,fraction='']=amount.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return cents<=999999999?cents:null;
}
