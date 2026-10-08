import {localInstant} from '../../../packages/domain/timezone.ts';

// Company dates and integer cents must not depend on the owner's device locale.
export function paymentInput(form:FormData,timezone:string){
 const amount=String(form.get('amount')||'');
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(amount))throw Error('Enter a positive dollar amount with up to two decimal places.');
 const [whole,fraction='']=amount.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(cents<1||cents>999999999)throw Error('Enter an amount greater than zero.');
 const receivedAt=new Date(localInstant(String(form.get('receivedAt')||''),timezone)).toISOString();
 return {cents,receivedAt,method:form.get('method'),reference:form.get('reference')};
}
