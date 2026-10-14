export const crmOrigin='https://yourneighborhoodserviceguy.app';
export const ownerStart=crmOrigin+'/owner?section=Requests';
export function mobileNavigation(value:string):'internal'|'external'|'blocked'{
 if(/[\r\n]|%0[ad]/i.test(value))return 'blocked';
 try{const url=new URL(value);if(url.username||url.password)return 'blocked';
  if(url.protocol==='https:')return url.origin===crmOrigin?'internal':'external';
  if(['tel:','mailto:','sms:'].includes(url.protocol))return 'external';
 }catch{}
 return 'blocked';
}
