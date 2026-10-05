import {z} from 'zod';
import {accessToken,serverDatabase} from './google-server';
import {busyTimes} from './google-core';
export const websiteSelection=z.object({mode:z.enum(['once','weekly']),start:z.iso.datetime(),token:z.string().regex(/^[a-f0-9]{64}$/),clientKey:z.uuid()}).strict();
export async function websiteBookingFacts(org:string,start:string){
 const db=serverDatabase();
 const cfg=await db.from('configuration_versions').select('settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).single();
 const buffer=cfg.data?.settings?.scheduling?.bufferMinutes;
 if(cfg.error||!Number.isInteger(buffer)||buffer<0||buffer>180)throw Error('SETUP_REQUIRED');
 const when=Date.parse(start);if(!Number.isFinite(when))throw Error('VALIDATION');
 const {token,account}=await accessToken(org);if(!account.calendar_id)throw Error('SETUP_REQUIRED');
 const windowStart=new Date(when-buffer*60000).toISOString(),windowEnd=new Date(when+(120+buffer)*60000).toISOString();
 return {...await busyTimes(token,account.calendar_id,windowStart,windowEnd),calendarId:account.calendar_id,connectionRevision:account.revision,windowStart,windowEnd};
}
