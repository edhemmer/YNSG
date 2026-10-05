export const CALENDAR_UNAVAILABLE='We can’t check open times right now. You can still send your request, or call 770-630-2094 to arrange a visit.';
export async function websiteAvailability(env=process.env,transport=fetch){
 let url;try{url=new URL(env.CRM_AVAILABILITY_URL);}catch{throw Error('SETUP_REQUIRED');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.username||url.password||url.search||url.hash||url.pathname!=='/api/public-availability')throw Error('SETUP_REQUIRED');
 const headers={Accept:'application/json'};
 const bypass=env.CRM_AVAILABILITY_BYPASS_SECRET;
 if(bypass){if(bypass.length<32||bypass.length>512||/\s/.test(bypass))throw Error('SETUP_REQUIRED');headers['x-vercel-protection-bypass']=bypass;}
 const response=await transport(url,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
 const result=await response.json();
 if(!response.ok||result?.reserved!==false||result.timezone!=='America/Chicago'||!Array.isArray(result.times)||result.times.length>3000||!Number.isFinite(Date.parse(result.validUntil))||Date.parse(result.validUntil)<=Date.now()||result.times.some(t=>typeof t.start!=='string'||typeof t.end!=='string'||!Number.isFinite(Date.parse(t.start))||!Number.isFinite(Date.parse(t.end))||Date.parse(t.end)<=Date.parse(t.start)))throw Error('UNAVAILABLE');
 return {times:result.times.map(t=>({start:t.start,end:t.end})),timezone:result.timezone,validUntil:result.validUntil,reserved:false};
}
