import {z} from 'zod';
export const googleNoticeStatus=z.object({missing:z.array(z.string()).max(20),calendarSyncEnabled:z.boolean(),dispatcherEnabled:z.boolean(),connection:z.object({connected:z.boolean(),health:z.string(),calendarId:z.string().nullable()}).passthrough().nullable()}).passthrough();
export function googleConnectionNotice(value:z.infer<typeof googleNoticeStatus>){
 if(value.missing.length)return {title:'Google setup needs attention',detail:'Google Calendar and Gmail cannot connect until setup is restored.'};
 if(!value.connection?.connected||value.connection.health==='disconnected')return {title:'Reconnect Google',detail:'Google Calendar export and Gmail sending are disconnected. Your CRM schedule remains saved; business email has separate delivery settings.'};
 if(value.connection.health==='reconnect_required')return {title:'Reconnect Google',detail:'Google authorization expired or was revoked. Open setup and reconnect to resume the Google connection.'};
 if(value.connection.health!=='healthy')return {title:'Check your Google connection',detail:'The last check did not confirm access. Open setup to check the connection or reconnect.'};
 if(!value.connection.calendarId)return {title:'Choose your Google calendar',detail:'Google is connected. Select the business calendar in setup to finish calendar configuration.'};
 if(!value.calendarSyncEnabled||!value.dispatcherEnabled)return {title:'Google connection has paused services',detail:[!value.calendarSyncEnabled?'Google Calendar export is paused.':'',!value.dispatcherEnabled?'Gmail sending is off. Business email may use its separately configured provider.':''].filter(Boolean).join(' ')};
 return null;
}
