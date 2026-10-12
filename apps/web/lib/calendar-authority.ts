import {serverDatabase,accessToken} from './google-server';
import {busyTimes} from './google-core';
import {reviewedBusy,type OwnEvent} from './google-availability';
export async function calendarAuthority(org:string){const r=await serverDatabase().rpc('calendar_authority',{p_org:org});if(r.error||!['crm','google'].includes(r.data?.source))throw Error('CALENDAR_AUTHORITY_REQUIRED');return r.data as {source:'crm'|'google';revision:number};}
export async function calendarFacts(org:string,begin:string,finish:string,timezone?:string,own?:OwnEvent|null){
 const authority=await calendarAuthority(org);
 if(authority.source==='crm'){const r=await serverDatabase().rpc('crm_calendar_facts',{p_org:org,p_begin:begin,p_finish:finish});if(r.error)throw Error('CRM_FACTS_REQUIRED');return r.data as {source:'crm';checkedAt:string;busy:{start:string;end:string}[];windowStart:string;windowEnd:string;authorityRevision:number;configurationVersion:number};}
 const {token,account}=await accessToken(org);if(!account.calendar_id)throw Error('CALENDAR_REQUIRED');
 const facts=timezone?await reviewedBusy(token,account.calendar_id,begin,finish,timezone,own||null):await busyTimes(token,account.calendar_id,begin,finish);
 return {...facts,source:'google',calendarId:account.calendar_id,connectionRevision:account.revision,windowStart:begin,windowEnd:finish};
}
