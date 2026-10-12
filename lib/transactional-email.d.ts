export class MailFailure extends Error {status:number;constructor(status:number,code?:string)}
export type MailPayload={action:'send'|'status';organization:string;id?:string;to?:string;subject?:string;body?:string;html?:string;replyTo?:string;attachment?:{filename:string;content:string}|undefined};
export function relayPayload(raw:unknown):MailPayload;
export function providerSender(env?:Record<string,string|undefined>):string;
export function providerEmail(raw:MailPayload,env?:Record<string,string|undefined>,transport?:typeof fetch):Promise<{ready?:boolean;provider?:string;sender?:string;accepted?:boolean;id?:string}>;
export function relayEmail(req:{body:unknown;headers:Record<string,string>},env?:Record<string,string|undefined>,transport?:typeof fetch):ReturnType<typeof providerEmail>;
