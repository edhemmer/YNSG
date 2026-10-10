export function hourlyCharge(minutes:number,rateCents:number){
 if(!Number.isSafeInteger(minutes)||minutes<0||minutes>1440||!Number.isSafeInteger(rateCents)||rateCents<0||rateCents>999999999)throw Error('INVALID_BILLING');
 const cents=Number((BigInt(minutes)*BigInt(rateCents)+30n)/60n);if(cents>999999999)throw Error('INVALID_BILLING');return cents;
}
export function billingLabel(line:{billingBasis?:string;billingMinutes?:number;unitRateCents?:number}){
 if(line.billingBasis==='fixed')return 'Fixed amount';
 if(line.billingBasis==='hourly'&&line.billingMinutes!==undefined&&line.unitRateCents!==undefined)return `${line.billingMinutes} billed minutes × ${(line.unitRateCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}/hour`;
 return 'Recorded service charge';
}
