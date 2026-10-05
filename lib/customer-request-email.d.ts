import type {EmailIdentity} from './email-layout.js';
export function customerRequestEmail(company:string,request:{name?:string;email:string;services?:{service:string;task:string}[];service?:string;task?:string;preferredTime?:string},identity?:EmailIdentity):{to:string;subject:string;body:string;html:string};
