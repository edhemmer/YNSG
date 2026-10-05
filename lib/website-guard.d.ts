export function validGuardSignature(secret:string|undefined,body:string,timestamp:string|null,signature:string|null,clock?:number):boolean;
export function guardDigest(secret:string,value:string):string;
