export const routeHealthLifetime=86400000;
export function routesRecentlyVerified(status:string|undefined,checkedAt:string|null|undefined,now=Date.now()){
 const checked=Date.parse(checkedAt||'');
 return status==='active'&&Number.isFinite(checked)&&checked<=now&&now-checked<routeHealthLifetime;
}
