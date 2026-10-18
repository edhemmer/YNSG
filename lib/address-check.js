// A Census street-range match is advisory, never proof of a building, unit or delivery point.
const states=new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
export class AddressInputFailure extends Error {constructor(){super('Enter a street address, city and U.S. state before checking.');this.status=400;}}
export function addressInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['street','city','state','postalCode'].includes(k)))throw new AddressInputFailure();
 const field=(name,max)=>{if(typeof raw[name]!=='string'||raw[name].length>max||/[\x00-\x1f\x7f<>]/.test(raw[name]))throw new AddressInputFailure();return raw[name].trim();};
 const street=field('street',200),city=field('city',80),state=field('state',2).toUpperCase(),postalCode=raw.postalCode===undefined?'':field('postalCode',10);
 if(street.length<5||!/^\d/.test(street)||city.length<2||!states.has(state)||(postalCode&&!/^\d{5}(?:-\d{4})?$/.test(postalCode)))throw new AddressInputFailure();
 return {street,city,state,postalCode};
}
export function checkAddress(raw,transport=fetch){return resolveAddress(raw,transport,false);}
// Server weather review only: never extend the public address-check response.
export function checkWeatherAddress(raw,transport=fetch){return resolveAddress(raw,transport,true);}
async function resolveAddress(raw,transport,includeCoordinates){
 const input=addressInput(raw),unit=input.street.match(/\s+((?:apt\.?|apartment|unit|suite|ste\.?|#)\s*.+)$/i),street=unit?input.street.slice(0,unit.index).trim():input.street;
 const url=new URL('https://geocoding.geo.census.gov/geocoder/locations/address');
 url.search=new URLSearchParams({street,city:input.city,state:input.state,...(input.postalCode?{zip:input.postalCode}:{}),benchmark:'Public_AR_Current',format:'json'}).toString();
 try{
  const response=await transport(url,{headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('UNAVAILABLE');
  const text=await response.text();if(text.length>100000)throw Error('UNAVAILABLE');
  const data=JSON.parse(text),matches=data?.result?.addressMatches;
  if(!Array.isArray(matches)||matches.length>20)throw Error('UNAVAILABLE');
  const candidates=[];
  for(const match of matches){
   const c=match.addressComponents;
   if(!c||typeof match.matchedAddress!=='string'||match.matchedAddress.length>400||typeof c.city!=='string'||c.city.length>80||c.state!==input.state||!states.has(c.state)||typeof c.zip!=='string'||!/^\d{5}$/.test(c.zip))continue;
   const base=match.matchedAddress.split(',')[0]?.trim();
   // Never suggest a different house number as a correction.
   if(!base||base.length>200||!/^\d/.test(base)||base.match(/^\S+/)?.[0].toUpperCase()!==street.match(/^\S+/)?.[0].toUpperCase()||/[\x00-\x1f\x7f<>]/.test(base+c.city))continue;
   const candidate={street:base+(unit?' '+unit[1]:''),city:c.city,state:c.state,postalCode:c.zip};
   if(includeCoordinates){
    const lat=match.coordinates?.y,lng=match.coordinates?.x;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<18||lat>72||lng< -180||!(lng<=-60||input.state==='AK'&&lng>=170))continue;
    candidate.coordinates={lat:Math.round(lat*10000)/10000,lng:Math.round(lng*10000)/10000};
   }
   if(candidate.street.length<=200&&!candidates.some(v=>JSON.stringify(v)===JSON.stringify(candidate)))candidates.push(candidate);
  }
  if(matches.length&&candidates.length===0)return {status:'no_match',candidates:[],unitChecked:false};
  if(candidates.length>3)return {status:'multiple',candidates:[],unitChecked:false};
  return {status:candidates.length===1?'match':candidates.length?'multiple':'no_match',candidates,unitChecked:false};
 }catch{return {status:'unavailable',candidates:[],unitChecked:false};}
}
