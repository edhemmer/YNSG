import {weatherPeriod,weatherAlert,weatherReport,type WeatherLocation} from './weather-contract.ts';
// Read-only public government sources. No model, scheduling command or customer message.
async function json(url:string,send:typeof fetch){
 const r=await send(url,{headers:{Accept:'application/geo+json','User-Agent':'YNSG-weather-review/1.0 (https://yourneighborhoodserviceguy.app)'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('WEATHER_UNAVAILABLE');const text=await r.text();if(text.length>1500000)throw Error('WEATHER_UNAVAILABLE');return JSON.parse(text);
}
export async function readWeather(location:WeatherLocation,startAt:string,endAt:string,send:typeof fetch=fetch,now=new Date()){
 const start=Math.max(Date.parse(startAt),now.getTime()),end=Date.parse(endAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000||start-now.getTime()>6*86400000)throw Error('WEATHER_WINDOW_UNAVAILABLE');
 const {lat,lng}=location.coordinates,pointUrl=`https://api.weather.gov/points/${lat},${lng}`;
 const point=await json(pointUrl,send),forecastUrl=point?.properties?.forecastHourly;
 if(typeof forecastUrl!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d{1,4},\d{1,4}\/forecast\/hourly$/.test(forecastUrl))throw Error('WEATHER_UNAVAILABLE');
 const [forecast,alerts]=await Promise.all([json(forecastUrl,send),json(`https://api.weather.gov/alerts?active=true&point=${lat},${lng}&limit=100`,send)]);
 const issuedAt=forecast?.properties?.updateTime,issued=Date.parse(issuedAt);
 if(!Number.isFinite(issued)||issued>now.getTime()+300000||issued<now.getTime()-21600000||!Array.isArray(forecast?.properties?.periods)||forecast.properties.periods.length>200||!Array.isArray(alerts?.features)||alerts.features.length>100||alerts.pagination?.next)throw Error('WEATHER_UNAVAILABLE');
 const periods=forecast.properties.periods.filter((p:{startTime:string;endTime:string})=>Date.parse(p.endTime)>start&&Date.parse(p.startTime)<end).map((p:{startTime:string;endTime:string;temperature:number;temperatureUnit:string;windSpeed:string;windDirection:string;shortForecast:string;probabilityOfPrecipitation?:{unitCode?:string;value:number|null}})=>{
  if(typeof p.windSpeed!=='string'||!/^\d{1,3}(?: to \d{1,3})? (?:mph|km\/h|m\/s|kt)$/.test(p.windSpeed)||typeof p.windDirection!=='string'||! /^(?:[NSEW]{1,3}|VRB|CALM)$/.test(p.windDirection))throw Error('WEATHER_UNAVAILABLE');
  const precipitation=p.probabilityOfPrecipitation;if(precipitation?.value!==null&&precipitation?.value!==undefined&&precipitation.unitCode!=='wmoUnit:percent')throw Error('WEATHER_UNAVAILABLE');
  return weatherPeriod.parse({startAt:p.startTime,endAt:p.endTime,temperature:p.temperature,temperatureUnit:p.temperatureUnit,wind:p.windSpeed+' '+p.windDirection,forecast:p.shortForecast,precipitationPercent:precipitation?.value??null});
 }).sort((a:{startAt:string},b:{startAt:string})=>Date.parse(a.startAt)-Date.parse(b.startAt));
 let covered=start,previousEnd=-Infinity;for(const p of periods){const a=Date.parse(p.startAt),b=Date.parse(p.endAt);if(a>covered||a<previousEnd||b<=a)throw Error('WEATHER_UNAVAILABLE');covered=Math.max(covered,b);previousEnd=b;}if(!periods.length||periods.length>26||covered<end)throw Error('WEATHER_UNAVAILABLE');
 const active=[];for(const f of alerts.features){const p=f?.properties,begin=Date.parse(p?.onset||p?.effective),finish=Date.parse(p?.ends||p?.expires);if(!p||!Number.isFinite(begin)||!Number.isFinite(finish)||finish<=begin)throw Error('WEATHER_UNAVAILABLE');if(begin<end&&finish>start)active.push(weatherAlert.parse({id:f.id,event:p.event,headline:p.headline||'',severity:p.severity,startsAt:new Date(begin).toISOString(),endsAt:new Date(finish).toISOString()}));}
 return {source:'National Weather Service' as const,issuedAt,expiresAt:new Date(Math.min(now.getTime()+900000,end,issued+21600000)).toISOString(),windowStartAt:new Date(start).toISOString(),windowEndAt:new Date(end).toISOString(),forecastPageUrl:`https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lng}`,forecastUrl,pointUrl,periods,alerts:active,complete:true as const};
}
