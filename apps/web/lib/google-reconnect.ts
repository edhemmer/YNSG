/** Only navigate to Google's code/PKCE consent endpoint for this CRM callback. */
export function googleReconnectUrl(value:unknown,origin:string){
 if(typeof value!=='string'||value.length>16000)throw Error('GOOGLE_ACTION_FAILED');
 const url=new URL(value),callback=new URL(url.searchParams.get('redirect_uri')||'');
 if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth'||url.username||url.password
  ||url.searchParams.get('response_type')!=='code'||url.searchParams.get('code_challenge_method')!=='S256'
  ||!url.searchParams.get('state')||!url.searchParams.get('code_challenge')||url.hash
  ||callback.protocol!=='https:'||callback.username||callback.password||callback.search||callback.hash||callback.pathname!=='/api/google/callback'
  ||![new URL(origin).origin,'https://yourneighborhoodserviceguy.app'].includes(callback.origin))throw Error('GOOGLE_ACTION_FAILED');
 return url.href;
}
