import {z} from 'zod';
export const googleNoticeStatus=z.object({missing:z.array(z.string()).max(20),calendarSyncEnabled:z.boolean(),dispatcherEnabled:z.boolean(),delivery:z.object({enabled:z.boolean()}).passthrough().nullable().optional(),connection:z.object({connected:z.boolean(),health:z.string(),calendarId:z.string().nullable(),services:z.object({calendar:z.boolean(),gmail:z.boolean()}).optional()}).passthrough().nullable()}).passthrough();
export function googleConnectionNotice(value:z.infer<typeof googleNoticeStatus>){
 if(value.missing.length)return {title:'Google setup needs attention',detail:'Google Calendar and Gmail cannot connect until setup is restored.'};
 if(!value.connection?.connected||value.connection.health==='disconnected')return {title:'Reconnect Google',detail:'Reconnect once for Calendar and Gmail. Your CRM schedule is saved; separately paused services stay paused.'};
 if(value.connection.health==='reconnect_required')return {title:'Reconnect Google',detail:'Google authorization expired or was revoked. Reconnect once to restore Calendar and Gmail access. Your saved calendar and approved settings are kept.'};
 if(value.connection.health!=='healthy')return {title:'Check your Google connection',detail:'The last check did not confirm access. Open setup to check the connection or reconnect.'};
 if(value.connection.services&&(!value.connection.services.calendar||!value.connection.services.gmail))return {title:'Reconnect Google',detail:'Calendar or Gmail permission is missing. Reconnect once and review Google’s requested access.'};
 if(!value.connection.calendarId)return {title:'Choose your Google calendar',detail:'Google is connected. Select the business calendar in setup to finish calendar configuration.'};
 if(!value.calendarSyncEnabled||!value.dispatcherEnabled)return {title:'Google connection has paused services',detail:[!value.calendarSyncEnabled?'Google Calendar export is paused.':'',!value.dispatcherEnabled?'Gmail sending is off. Business email may use its separately configured provider.':''].filter(Boolean).join(' ')};
 if(value.delivery?.enabled===false)return {title:'Finish Gmail setup',detail:'Google is connected, but Gmail sending is not approved for this business. Review its sending setup; business email may use a separate provider.'};
 if(value.delivery===null)return {title:'Check Gmail setup',detail:'Google is connected, but its sending approval could not be confirmed. Open setup to review the service status.'};
 return null;
}
