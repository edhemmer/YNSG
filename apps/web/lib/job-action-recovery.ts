import {z} from 'zod';
import {jobAction} from '../../../packages/contracts/operations.ts';
export type JobAction = z.infer<typeof jobAction>;
export const jobActionResult=z.object({id:z.uuid(),revision:z.number().int().positive(),status:z.enum(['working','paused'])}).strict();
export const jobActionResponse=z.object({ok:z.literal(true),result:jobActionResult}).strict();
export function verifyJobActionResult(value:unknown,command:JobAction){
 const result=jobActionResult.parse(value);
 if(result.id!==command.id||result.revision!==command.revision+1||result.status!==(command.action==='pause'?'paused':'working'))throw Error('UNCONFIRMED_JOB_ACTION');
 return result;
}
// Device-local frozen retry, not authorization. The server rechecks identity,
// current company access, exact revision and the actor-bound canonical receipt.
const storedAction=z.object({version:z.literal(1),actor:z.string().min(1).max(254),body:jobAction.extend({note:z.literal('')}).strict()}).strict();
export type PendingJobAction=z.infer<typeof storedAction>;
type DeviceStore=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const jobRecoveryKey=(actor:string)=>'ynsg.job-action.v1:'+encodeURIComponent(actor);
export function readJobRecovery(store:DeviceStore,actor:string):PendingJobAction|null{
 const raw=store.getItem(jobRecoveryKey(actor));if(raw===null)return null;
 if(raw.length>3000)throw Error('RECOVERY_UNAVAILABLE');
 const value=storedAction.parse(JSON.parse(raw));if(value.actor!==actor)throw Error('RECOVERY_UNAVAILABLE');return value;
}
export function saveJobRecovery(store:DeviceStore,value:PendingJobAction){
 const entry=storedAction.parse(value),existing=readJobRecovery(store,entry.actor);
 if(existing&&JSON.stringify(existing)!==JSON.stringify(entry))throw Error('PENDING_JOB_ACTION');
 const raw=JSON.stringify(entry);store.setItem(jobRecoveryKey(entry.actor),raw);
 if(store.getItem(jobRecoveryKey(entry.actor))!==raw)throw Error('RECOVERY_UNAVAILABLE');
 return entry;
}
export function clearJobRecovery(store:DeviceStore,entry:PendingJobAction){
 const expected=storedAction.parse(entry),existing=readJobRecovery(store,expected.actor);
 if(existing&&JSON.stringify(existing)!==JSON.stringify(expected))throw Error('PENDING_JOB_ACTION');
 store.removeItem(jobRecoveryKey(expected.actor));
 if(store.getItem(jobRecoveryKey(expected.actor))!==null)throw Error('RECOVERY_UNAVAILABLE');
}
