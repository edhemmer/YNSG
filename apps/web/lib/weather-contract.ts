import {z} from 'zod';
import {propertyValue} from './customer-record-contract.ts';
export const weatherQuery=z.object({organization:z.uuid(),appointment:z.uuid(),revision:z.coerce.number().int().positive().max(2147483647)}).strict();
export const weatherRequest=weatherQuery.extend({locationKey:z.string().regex(/^[a-f0-9]{64}$/),reviewed:z.literal(true)}).strict();
export const weatherLocation=propertyValue.extend({coordinates:z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}).strict()}).strict();
const time=z.iso.datetime({offset:true}),meta={organization:z.uuid(),appointment:z.uuid(),revision:z.number().int().positive(),location:weatherLocation,locationKey:z.string().regex(/^[a-f0-9]{64}$/),appointmentStartAt:time,appointmentEndAt:time,checkedAt:time,stateSource:z.enum(['request','intake_settings']),configurationVersion:z.number().int().positive().nullable()};
export const weatherLocationReview=z.object({...meta,source:z.literal('U.S. Census street-range match'),unitChecked:z.literal(false)}).strict();
export const weatherPeriod=z.object({startAt:time,endAt:time,temperature:z.number().finite().min(-150).max(150),temperatureUnit:z.enum(['F','C']),wind:z.string().min(1).max(80),forecast:z.string().min(1).max(500),precipitationPercent:z.number().min(0).max(100).nullable()}).strict();
export const weatherAlert=z.object({id:z.string().min(1).max(500),event:z.string().min(1).max(200),headline:z.string().max(1000),severity:z.enum(['Extreme','Severe','Moderate','Minor','Unknown']),startsAt:time,endsAt:time}).strict();
export const weatherReport=z.object({...meta,source:z.literal('National Weather Service'),issuedAt:time,expiresAt:time,windowStartAt:time,windowEndAt:time,forecastPageUrl:z.string().regex(/^https:\/\/forecast\.weather\.gov\/MapClick\.php\?lat=-?\d+(\.\d+)?&lon=-?\d+(\.\d+)?$/),forecastUrl:z.string().regex(/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d{1,4},\d{1,4}\/forecast\/hourly$/),pointUrl:z.string().regex(/^https:\/\/api\.weather\.gov\/points\/-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),periods:z.array(weatherPeriod).min(1).max(26),alerts:z.array(weatherAlert).max(100),complete:z.literal(true)}).strict();
export type WeatherQuery=z.infer<typeof weatherQuery>;
export type WeatherLocation=z.infer<typeof weatherLocation>;
export type WeatherReport=z.infer<typeof weatherReport>;
export function hasOutdoorWork(items:{service:string;task?:string}[]){return items.some(x=>/^(?:lawn care|yard & garden|snow clearing|concrete pressure washing)$/.test(x.service.trim().toLowerCase())||/\bmow(?:ing)?\b|\bleaf\b|\bleaves\b|\bmulch\b|\bweed(?:s|ing)?\b|\bpressure wash(?:ing)?\b|\bsnow (?:remov(?:al|ing)|clear(?:ing)?)\b|\bsmall bush(?:es)?\b|\bplant(?:ing)? (?:small )?(?:flowers|bushes)\b/.test((x.service+' '+(x.task||'')).toLowerCase()));}
export function currentWeather(report:WeatherReport,now=Date.now()){
 return now>=Date.parse(report.checkedAt)-300000&&now<Date.parse(report.expiresAt)&&Date.parse(report.expiresAt)<=Date.parse(report.checkedAt)+900000&&Date.parse(report.issuedAt)<=now+300000&&Date.parse(report.issuedAt)>=now-21600000&&now<Date.parse(report.windowEndAt);
}
