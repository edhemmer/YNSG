const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type OwnerRequestContext={request:string;organization:string};
export function ownerRequestContext(value:unknown):OwnerRequestContext|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Record<string,unknown>;
 return typeof v.request==='string'&&uuid.test(v.request)&&typeof v.organization==='string'&&uuid.test(v.organization)?{request:v.request,organization:v.organization}:null;
}
export function applicationOrigin(value:string):string{
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.hostname==='vercel.com'||u.hostname.endsWith('.vercel.com'))throw Error('APPLICATION_ORIGIN_REQUIRED');
 return u.origin;
}
export function ownerRequestUrl(origin:string,request:string,organization:string):string{
 const context=ownerRequestContext({request,organization});if(!context)throw Error('REQUEST_CONTEXT_REQUIRED');
 const u=new URL('/owner',applicationOrigin(origin));u.search=new URLSearchParams(context).toString();return u.toString();
}
export function ownerReturnTarget(target:string,value:unknown):string{
 const context=ownerRequestContext(value);
 if(!context||!['/owner','/owner?setup=google'].includes(target))return target;
 const u=new URL(target,'https://navigation.invalid');for(const [k,v] of Object.entries(context))u.searchParams.set(k,v);
 return u.pathname+u.search;
}
